import express from 'express';
import { supabase } from './supabaseClient.js';
import { notifyTenant } from './notifyService.js';
import { autoSettleBillsForWallet } from './billingService.js';

export const mpesaRouter = express.Router();

const allowedIpList = (process.env.MPESA_ALLOWED_IPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const callbackToken = process.env.MPESA_WEBHOOK_TOKEN || '';

function isIpAllowed(req) {
  if (!allowedIpList.length) return true;
  const xff = (req.headers['x-forwarded-for'] || '').toString();
  const remoteIp = req.socket?.remoteAddress || '';
  const ipCandidates = [...xff.split(',').map((v) => v.trim()), remoteIp].filter(Boolean);
  return ipCandidates.some((ip) => allowedIpList.includes(ip));
}

function isCallbackTokenValid(req) {
  if (!callbackToken) return true;
  const token = (req.headers['x-callback-token'] || '').toString();
  return token && token === callbackToken;
}

function guardMpesaRequest(req, res) {
  if (!isIpAllowed(req)) {
    console.warn('Blocked M-Pesa callback: IP not allowed', req.socket?.remoteAddress);
    return res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
  }
  if (!isCallbackTokenValid(req)) {
    console.warn('Blocked M-Pesa callback: invalid token');
    return res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
  }
  return null;
}

/**
 * C2B confirmation handler (multi-paybill aware).
 * Configure this URL in Safaricom portal as ConfirmationURL.
 */
async function handleC2BConfirm(req, res) {
  const guard = guardMpesaRequest(req, res);
  if (guard) return guard;

  try {
    const payload = req.body || {};
    console.log('Received M-Pesa C2B payload:', JSON.stringify(payload));

    const shortcode = (payload.BusinessShortCode || payload.businessShortCode || '').toString().trim();
    const accountRef = (payload.BillRefNumber || payload.AccountReference || '').toString().trim();
    const transId = (payload.TransID || payload.transId || payload.ReceiptNumber || '').toString().trim();
    const amount = Number(payload.TransAmount || payload.amount || 0);
    const phone = (payload.MSISDN || payload.msisdn || payload.SenderMSISDN || '').toString().trim();
    const transactionType = payload.TransactionType || payload.transactionType || 'Pay Bill';

    if (!shortcode || !accountRef || !transId || !amount) {
      console.warn('C2B missing required fields, acknowledging anyway.');
      return res.json({ ResultCode: 0, ResultDesc: 'Received' });
    }

    // 1) Paybill lookup
    const { data: paybill, error: paybillError } = await supabase
      .from('paybills')
      .select('id, shortcode, name, is_active')
      .eq('shortcode', shortcode)
      .maybeSingle();

    if (paybillError) {
      console.error('Error checking paybill:', paybillError);
    }

    if (!paybill || !paybill.is_active) {
      console.warn('C2B for unknown or inactive paybill:', shortcode);
      return res.json({ ResultCode: 0, ResultDesc: 'Received' });
    }

    const paybillId = paybill.id;

    // 2) Idempotency
    const { data: existingTx, error: existingTxError } = await supabase
      .from('wallet_transactions')
      .select('id')
      .eq('mpesa_receipt', transId)
      .maybeSingle();

    if (existingTxError) {
      console.error('Error checking existing transaction:', existingTxError);
    }

    if (existingTx) {
      console.log('Duplicate C2B transaction, already processed:', transId);
      return res.json({ ResultCode: 0, ResultDesc: 'Processed' });
    }

    // 3) Wallet lookup by account_reference (prefer matching paybill)
    let wallet = null;
    let walletError = null;
    const { data: walletMatchPaybill, error: walletMatchPaybillError } = await supabase
      .from('wallet_accounts')
      .select('id, tenancy_id, landlord_id, balance, status')
      .eq('account_reference', accountRef)
      .eq('status', 'active')
      .eq('paybill_id', paybillId)
      .maybeSingle();

    if (walletMatchPaybillError) {
      walletError = walletMatchPaybillError;
    }

    if (walletMatchPaybill) {
      wallet = walletMatchPaybill;
    } else {
      const { data: walletAnyPaybill, error: walletAnyError } = await supabase
        .from('wallet_accounts')
        .select('id, tenancy_id, landlord_id, balance, status, paybill_id')
        .eq('account_reference', accountRef)
        .eq('status', 'active')
        .maybeSingle();
      walletError = walletAnyError;
      wallet = walletAnyPaybill;
    }

    if (walletError) {
      console.error('Error fetching wallet:', walletError);
    }

    if (!wallet) {
      console.warn('No wallet found for account reference:', accountRef);
      return res.json({ ResultCode: 0, ResultDesc: 'Received' });
    }

    const walletId = wallet.id;

    // 4) Tenancy + tenant (for notifications & landlord_id fallback)
    let tenancy = null;
    const { data: tenancyData, error: tenancyError } = await supabase
      .from('tenancies')
      .select('id, tenant_id, landlord_id')
      .eq('id', wallet.tenancy_id)
      .maybeSingle();
    if (!tenancyError && tenancyData) tenancy = tenancyData;

    let tenant = null;
    if (tenancy?.tenant_id) {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id, phone, full_name')
        .eq('id', tenancy.tenant_id)
        .maybeSingle();
      if (!tenantError) {
        tenant = tenantData;
      } else {
        console.error('Error fetching tenant:', tenantError);
      }
    }

    const landlordId = wallet.landlord_id || tenancy?.landlord_id || null;
    const nowIso = new Date().toISOString();

    // 5) Insert wallet transaction (credit)
    const { data: txInsert, error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: walletId,
        tenancy_id: wallet.tenancy_id,
        landlord_id: landlordId,
        paybill_id: paybillId,
        type: 'credit',
        source: 'mpesa_c2b',
        amount,
        mpesa_receipt: transId,
        phone,
        narration: `${transactionType} via ${shortcode}`,
        created_at: nowIso,
      })
      .select('id')
      .single();

    if (txError) {
      console.error('Error inserting wallet transaction:', txError);
      return res.json({ ResultCode: 0, ResultDesc: 'Received' });
    }

    // 6) Update wallet balance and tag paybill/landlord
    const newBalance = Number(wallet.balance || 0) + amount;
    const { error: walletUpdateError } = await supabase
      .from('wallet_accounts')
      .update({
        balance: newBalance,
        paybill_id: paybillId,
        landlord_id: landlordId,
        updated_at: nowIso,
      })
      .eq('id', walletId);

    if (walletUpdateError) {
      console.error('Error updating wallet balance:', walletUpdateError);
    }

    // 7) Auto-settle bills (best-effort)
    try {
      await autoSettleBillsForWallet(walletId);
    } catch (applyErr) {
      console.error('Error auto-settling bills:', applyErr);
    }

    // 8) Notify tenant
    if (tenant) {
      const msg = `Rent payment received: KES ${amount.toLocaleString('en-KE', {
        minimumFractionDigits: 0,
      })}. Wallet: ${accountRef}. New balance: KES ${newBalance.toLocaleString('en-KE', {
        minimumFractionDigits: 0,
      })}.`;

      await notifyTenant({
        tenantId: tenant.id,
        phone: tenant.phone,
        type: 'wallet_topup',
        title: 'Wallet Top-Up Received',
        message: msg,
        meta: {
          tenancy_id: tenancy?.id || null,
          wallet_id: walletId,
          paybill_id: paybillId,
        },
      });
    }

    console.log('Processed C2B top-up:', { walletId, txId: txInsert?.id, transId });
    return res.json({ ResultCode: 0, ResultDesc: 'Received successfully' });
  } catch (err) {
    console.error('Fatal error in C2B confirm:', err);
    return res.json({ ResultCode: 0, ResultDesc: 'Processed with internal error' });
  }
}

// Validation URL (Safaricom calls before confirm). We simply acknowledge after guard.
mpesaRouter.post('/c2b/validate', (req, res) => {
  const guard = guardMpesaRequest(req, res);
  if (guard) return guard;
  return res.json({ ResultCode: 0, ResultDesc: 'Validated' });
});

mpesaRouter.post('/c2b/confirm', handleC2BConfirm);
// legacy path support
mpesaRouter.post('/paybill-callback', handleC2BConfirm);

// Placeholder STK callback (implement settlement logic when STK is enabled)
mpesaRouter.post('/stk/confirm', (req, res) => {
  const guard = guardMpesaRequest(req, res);
  if (guard) return guard;
  console.log('Received STK callback payload:', JSON.stringify(req.body || {}));
  return res.json({ ResultCode: 0, ResultDesc: 'Received' });
});
