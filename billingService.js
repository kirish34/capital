import { supabase } from './supabaseClient.js';
import { notifyTenant } from './notifyService.js';

/**
 * Auto settle unpaid/partial bills using the wallet balance.
 * This runs sequentially to keep logic simple; for production you may want DB-level transactions.
 */
export async function autoSettleBillsForWallet(walletId) {
  // 1. Get wallet + tenancy
  const { data: wallet, error: walletError } = await supabase
    .from('wallet_accounts')
    .select('id, tenancy_id, balance')
    .eq('id', walletId)
    .eq('status', 'active')
    .single();

  if (walletError || !wallet) {
    console.error('autoSettleBillsForWallet: wallet not found', walletError);
    return;
  }

  let availableBalance = Number(wallet.balance);
  if (availableBalance <= 0) {
    console.log('autoSettleBillsForWallet: no balance to settle');
    return;
  }

  // 2. Get tenancy + tenant info for notifications
  const { data: tenancy, error: tenancyError } = await supabase
    .from('tenancies')
    .select('id, tenant_id')
    .eq('id', wallet.tenancy_id)
    .single();

  if (tenancyError || !tenancy) {
    console.error('autoSettleBillsForWallet: tenancy not found', tenancyError);
    return;
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, phone, full_name')
    .eq('id', tenancy.tenant_id)
    .single();

  if (tenantError || !tenant) {
    console.error('autoSettleBillsForWallet: tenant not found', tenantError);
    return;
  }

  // 3. Fetch unpaid/partial/overdue bills for this tenancy (oldest first)
  const { data: bills, error: billsError } = await supabase
    .from('bills')
    .select(
      'id, billing_period, rent_amount, water_amount, waste_amount, penalty_amount, other_charges, total_amount, amount_paid, status'
    )
    .eq('tenancy_id', wallet.tenancy_id)
    .in('status', ['unpaid', 'partial', 'overdue'])
    .order('due_date', { ascending: true })
    .order('billing_period', { ascending: true });

  if (billsError) {
    console.error('autoSettleBillsForWallet: error fetching bills', billsError);
    return;
  }

  if (!bills || bills.length === 0) {
    console.log('autoSettleBillsForWallet: no unpaid/partial bills');
    return;
  }

  const notificationsToSend = [];

  // 4. Loop bills and settle from wallet
  for (const bill of bills) {
    if (availableBalance <= 0) break;

    const needed = Number(bill.total_amount) - Number(bill.amount_paid);
    if (needed <= 0) continue;

    const payAmount = Math.min(availableBalance, needed);

    // 4.1 Insert wallet_transactions (debit)
    const { error: txError } = await supabase.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      tenancy_id: wallet.tenancy_id,
      type: 'debit',
      source: 'bill_settlement',
      amount: payAmount,
      narration: `Auto-settlement for bill ${bill.billing_period}`,
    });

    if (txError) {
      console.error('autoSettleBillsForWallet: error inserting debit transaction', txError);
      // Break to avoid mismatched states
      break;
    }

    // 4.2 Insert payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      bill_id: bill.id,
      tenancy_id: wallet.tenancy_id,
      wallet_id: wallet.id,
      amount: payAmount,
      method: 'wallet_auto',
      status: 'successful',
    });

    if (paymentError) {
      console.error('autoSettleBillsForWallet: error inserting payment', paymentError);
      break;
    }

    // 4.3 Update bill amount_paid + status
    const newAmountPaid = Number(bill.amount_paid) + payAmount;
    let newStatus = bill.status;

    if (newAmountPaid >= Number(bill.total_amount)) {
      newStatus = 'paid';
    } else {
      newStatus = 'partial';
    }

    const { error: billUpdateError } = await supabase
      .from('bills')
      .update({
        amount_paid: newAmountPaid,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bill.id);

    if (billUpdateError) {
      console.error('autoSettleBillsForWallet: error updating bill', billUpdateError);
      break;
    }

    // 4.4 Decrease local wallet balance
    availableBalance -= payAmount;

    // Keep track for notifications
    notificationsToSend.push({
      bill,
      payAmount,
      newAmountPaid,
      newStatus,
      balanceAfter: availableBalance,
    });
  }

  // 5. Persist new wallet balance (after loop)
  const { error: walletUpdateError } = await supabase
    .from('wallet_accounts')
    .update({
      balance: availableBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  if (walletUpdateError) {
    console.error('autoSettleBillsForWallet: error updating wallet final balance', walletUpdateError);
  }

  // 6. Send notifications (one per touched bill)
  for (const item of notificationsToSend) {
    const { bill, payAmount, newAmountPaid, newStatus, balanceAfter } = item;
    const remaining = Number(bill.total_amount) - newAmountPaid;

    if (newStatus === 'paid') {
      const msg = `
You have fully paid your bill for ${bill.billing_period}.
Amount paid this time: KES ${payAmount.toFixed(2)}.
Total paid: KES ${newAmountPaid.toFixed(2)}.
Wallet balance: KES ${balanceAfter.toFixed(2)}.
      `.trim();

      await notifyTenant({
        tenantId: tenant.id,
        phone: tenant.phone,
        type: 'payment_success',
        title: `Bill ${bill.billing_period} paid in full`,
        message: msg,
        meta: {
          tenancy_id: tenancy.id,
          bill_id: bill.id,
          wallet_id: wallet.id,
        },
      });
    } else if (newStatus === 'partial') {
      const msg = `
KES ${payAmount.toFixed(2)} has been deducted from your wallet for bill ${bill.billing_period}.
Total paid so far: KES ${newAmountPaid.toFixed(2)}.
Remaining balance: KES ${remaining.toFixed(2)}.
Wallet balance: KES ${balanceAfter.toFixed(2)}.
      `.trim();

      await notifyTenant({
        tenantId: tenant.id,
        phone: tenant.phone,
        type: 'payment_partial',
        title: `Partial payment for ${bill.billing_period}`,
        message: msg,
        meta: {
          tenancy_id: tenancy.id,
          bill_id: bill.id,
          wallet_id: wallet.id,
        },
      });
    }
  }

  console.log(
    `autoSettleBillsForWallet: completed for wallet ${wallet.id}. Final balance: ${availableBalance}`
  );
}
