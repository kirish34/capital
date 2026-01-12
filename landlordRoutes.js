import express from 'express';
import { supabase } from './supabaseClient.js';
import { getLandlordDashboard } from './dashboardService.js';
import { requireLandlord } from './authMiddleware.js';

export const landlordRouter = express.Router();

landlordRouter.use(requireLandlord);

function getCurrentBillingPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function ensureWalletAndInitialBill({
  tenancyId,
  landlordId,
  rentAmount = 0,
  wasteAmount = 0,
  billingDay = 1,
}) {
  if (!tenancyId) return;

  let walletId = null;
  let accountReference = null;
  let paybillId = null;

  try {
    const { data: existingWallet } = await supabase
      .from('wallet_accounts')
      .select('id')
      .eq('tenancy_id', tenancyId)
      .maybeSingle();

    if (existingWallet?.id) {
      walletId = existingWallet.id;
    } else {
      const { data: landlord } = await supabase
        .from('landlords')
        .select('paybill_id')
        .eq('id', landlordId)
        .maybeSingle();

      paybillId = landlord?.paybill_id || null;
      accountReference = `TEN-${tenancyId}`;

      const { data: walletInsert, error: walletInsertError } = await supabase
        .from('wallet_accounts')
        .insert({
          tenancy_id: tenancyId,
          landlord_id: landlordId,
          paybill_id: paybillId,
          account_reference: accountReference,
          balance: 0,
          status: 'active',
        })
        .select('id, account_reference, paybill_id')
        .single();

      if (walletInsertError) {
        console.error('Failed to create wallet for tenancy', tenancyId, walletInsertError);
      } else {
        walletId = walletInsert.id;
        accountReference = walletInsert.account_reference;
        paybillId = walletInsert.paybill_id;
      }
    }
  } catch (err) {
    console.error('ensureWalletAndInitialBill wallet error', err);
  }

  try {
    const billingPeriod = getCurrentBillingPeriod();

    const { data: existingBill } = await supabase
      .from('bills')
      .select('id')
      .eq('tenancy_id', tenancyId)
      .eq('billing_period', billingPeriod)
      .maybeSingle();

    if (!existingBill) {
      const rent = Number(rentAmount || 0);
      const waste = Number(wasteAmount || 0);
      const total = rent + waste;
      const dueDay = String(billingDay || 1).padStart(2, '0');
      const dueDate = `${billingPeriod}-${dueDay}`;

      const { error: billError } = await supabase.from('bills').insert({
        tenancy_id: tenancyId,
        billing_period: billingPeriod,
        rent_amount: rent,
        water_amount: 0,
        waste_amount: waste,
        penalty_amount: 0,
        other_charges: 0,
        total_amount: total,
        amount_paid: 0,
        status: 'unpaid',
        due_date: dueDate,
      });

      if (billError) {
        console.error('Failed to create initial bill for tenancy', tenancyId, billError);
      }
    }
  } catch (err) {
    console.error('ensureWalletAndInitialBill bill error', err);
  }

  return { walletId, accountReference, paybillId };
}

// GET /landlord/dashboard
landlordRouter.get('/dashboard', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const propertyId = req.query.propertyId ? Number(req.query.propertyId) : null;
    const billingPeriod = req.query.billingPeriod || null;

    const data = await getLandlordDashboard({
      landlordId,
      propertyId,
      billingPeriod,
    });

    return res.json(data);
  } catch (err) {
    console.error('Error in GET /landlord/dashboard:', err);
    return res.status(500).json({ message: 'Failed to load dashboard' });
  }
});

// GET /landlord/properties
landlordRouter.get('/properties', async (req, res) => {
  try {
    const landlordId = req.landlordId;

    const { data: properties, error: propsError } = await supabase
      .from('properties')
      .select('id, name, location')
      .eq('landlord_id', landlordId);

    if (propsError) throw propsError;
    if (!properties || properties.length === 0) return res.json({ properties: [], units: [] });

    const propIds = properties.map((p) => p.id);

    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, property_id, unit_code, type, status, base_rent, waste_fee')
      .in('property_id', propIds);

    if (unitsError) throw unitsError;

    const byProperty = properties.map((p) => {
      const propUnits = units.filter((u) => u.property_id === p.id);
      const totalUnits = propUnits.length;
      const occupied = propUnits.filter((u) => u.status === 'occupied').length;
      const vacant = propUnits.filter((u) => u.status === 'vacant').length;
      return {
        ...p,
        totalUnits,
        occupied,
        vacant,
      };
    });

    return res.json({ properties: byProperty, units });
  } catch (err) {
    console.error('GET /landlord/properties error:', err);
    return res.status(500).json({ message: 'Failed to load properties' });
  }
});

// GET /landlord/properties/:propertyId/units
landlordRouter.get('/properties/:propertyId/units', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const propertyId = Number(req.params.propertyId);
    if (!propertyId) {
      return res.status(400).json({ message: 'propertyId is required' });
    }

    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, unit_code, type, status, base_rent, waste_fee')
      .eq('property_id', propertyId);

    if (unitsError) throw unitsError;
    if (!units || units.length === 0) return res.json({ units: [] });

    const unitIds = units.map((u) => u.id);

    const { data: tenancies, error: tenanciesError } = await supabase
      .from('tenancies')
      .select('id, tenant_id, unit_id, status, start_date, rent_amount')
      .eq('landlord_id', landlordId)
      .in('unit_id', unitIds)
      .in('status', ['active', 'pending_move_in']);

    if (tenanciesError) throw tenanciesError;

    const tenantIds = [...new Set(tenancies.map((t) => t.tenant_id))];
    let tenantsMap = new Map();
    if (tenantIds.length) {
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, full_name, phone')
        .in('id', tenantIds);

      if (tenantsError) throw tenantsError;
      tenantsMap = new Map(tenants.map((t) => [t.id, t]));
    }

    const tenancyByUnitId = new Map();
    for (const t of tenancies) {
      tenancyByUnitId.set(t.unit_id, {
        id: t.id,
        tenant: tenantsMap.get(t.tenant_id) || null,
        status: t.status,
        startDate: t.start_date,
        rentAmount: t.rent_amount,
      });
    }

    const unitsWithTenancy = units.map((u) => ({
      ...u,
      tenancy: tenancyByUnitId.get(u.id) || null,
    }));

    return res.json({ units: unitsWithTenancy });
  } catch (err) {
    console.error('GET /landlord/properties/:propertyId/units error:', err);
    return res.status(500).json({ message: 'Failed to load units' });
  }
});

// GET /landlord/tenancies/:tenancyId/overview
landlordRouter.get('/tenancies/:tenancyId/overview', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const tenancyId = Number(req.params.tenancyId);
    if (!tenancyId) {
      return res.status(400).json({ message: 'tenancyId is required' });
    }

    const { data: tenancyRow, error: tenancyError } = await supabase
      .from('tenancies')
      .select('id, tenant_id, unit_id, landlord_id, start_date, end_date, status, rent_amount, deposit_amount')
      .eq('id', tenancyId)
      .eq('landlord_id', landlordId)
      .maybeSingle();

    if (tenancyError || !tenancyRow) {
      return res.status(404).json({ message: 'Tenancy not found' });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, full_name, phone, email, id_number')
      .eq('id', tenancyRow.tenant_id)
      .maybeSingle();

    if (tenantError) {
      console.error('tenant fetch error', tenantError);
    }

    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, unit_code, type, property_id')
      .eq('id', tenancyRow.unit_id)
      .maybeSingle();

    if (unitError) {
      console.error('unit fetch error', unitError);
    }

    let property = null;
    if (unit?.property_id) {
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('id, name, location')
        .eq('id', unit.property_id)
        .maybeSingle();

      if (propertyError) {
        console.error('property fetch error', propertyError);
      } else {
        property = propertyData;
      }
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallet_accounts')
      .select('id, account_reference, balance, status, created_at')
      .eq('tenancy_id', tenancyId)
      .maybeSingle();

    if (walletError) {
      console.error('wallet fetch error', walletError);
    }

    let walletTransactions = [];
    if (wallet?.id) {
      const { data: tx, error: txError } = await supabase
        .from('wallet_transactions')
        .select('id, type, source, amount, mpesa_receipt, phone, narration, created_at')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (txError) throw txError;
      walletTransactions = tx || [];
    }

    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('id, billing_period, total_amount, amount_paid, status, due_date, created_at')
      .eq('tenancy_id', tenancyId)
      .order('billing_period', { ascending: false })
      .limit(24);

    if (billsError) throw billsError;

    const billIds = bills.map((b) => b.id);
    let payments = [];
    if (billIds.length) {
      const { data: payData, error: payError } = await supabase
        .from('payments')
        .select('id, bill_id, amount, method, status, paid_at')
        .in('bill_id', billIds)
        .order('paid_at', { ascending: false });

      if (payError) throw payError;
      payments = payData || [];
    }

    return res.json({
      tenancy: {
        ...tenancyRow,
        tenants: tenant || null,
        units: unit || null,
        properties: property || null,
      },
      wallet: wallet || null,
      walletTransactions,
      bills,
      payments,
    });
  } catch (err) {
    console.error('GET /landlord/tenancies/:tenancyId/overview error:', err);
    return res.status(500).json({ message: 'Failed to load tenancy details' });
  }
});

// POST /landlord/tenants (landlord-managed tenant creation)
landlordRouter.post('/tenants', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const { fullName, phone, email, idNumber, kraPin, propertyId, unitId } = req.body || {};
    if (!fullName || !phone) {
      return res.status(400).json({ message: 'fullName and phone are required' });
    }
    if (!propertyId || !unitId) {
      return res.status(400).json({ message: 'Select property and vacant unit to place this tenant.' });
    }

    // verify property belongs to landlord
    const { data: propertyRow, error: propErr } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('landlord_id', landlordId)
      .maybeSingle();
    if (propErr || !propertyRow) {
      return res.status(400).json({ message: 'Property not found for this landlord' });
    }

    // verify unit is vacant and belongs to property
    const { data: unit, error: unitErr } = await supabase
      .from('units')
      .select('id, property_id, unit_code, base_rent, waste_fee, status')
      .eq('id', unitId)
      .eq('property_id', propertyId)
      .maybeSingle();

    if (unitErr || !unit) {
      return res.status(400).json({ message: 'Unit not found' });
    }
    if (unit.status !== 'vacant') {
      return res.status(400).json({ message: 'Unit is not vacant' });
    }

    // create tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        full_name: fullName,
        phone,
        email: email || null,
        id_number: idNumber || null,
        kra_pin: kraPin || null,
      })
      .select('id, full_name, phone, email, id_number, kra_pin, status, created_at')
      .single();
    if (error) {
      console.error('landlord create tenant error:', error);
      return res.status(500).json({ message: 'Failed to create tenant' });
    }

    // create tenancy and mark unit occupied
    const today = new Date().toISOString().slice(0, 10);
    const rentAmount = Number(unit.base_rent || 0);
    const { data: tenancyRow, error: tenancyErr } = await supabase
      .from('tenancies')
      .insert({
        tenant_id: tenant.id,
        unit_id: unit.id,
        landlord_id: landlordId,
        start_date: today,
        rent_amount: rentAmount,
        deposit_amount: 0,
        billing_day: 1,
        status: 'active',
      })
      .select('id, billing_day')
      .single();
    if (tenancyErr) {
      console.error('Failed to create tenancy for unit', tenancyErr);
      return res.status(500).json({ message: 'Failed to create tenancy' });
    }
    await supabase.from('units').update({ status: 'occupied', updated_at: new Date().toISOString() }).eq('id', unit.id);

    await ensureWalletAndInitialBill({
      tenancyId: tenancyRow.id,
      landlordId,
      rentAmount,
      wasteAmount: Number(unit.waste_fee || 0),
      billingDay: tenancyRow.billing_day || 1,
    });

    return res.status(201).json({ message: 'Tenant created and linked to unit', tenant });
  } catch (err) {
    console.error('POST /landlord/tenants error:', err);
    return res.status(500).json({ message: 'Failed to create tenant' });
  }
});

// POST /landlord/tenants/:tenantId/auth - create login for tenant (landlord scope)
landlordRouter.post('/tenants/:tenantId/auth', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const tenantId = Number(req.params.tenantId);
    const { email, password } = req.body || {};
    if (!tenantId || !email || !password) {
      return res.status(400).json({ message: 'tenantId, email and password are required' });
    }

    // confirm tenant belongs to this landlord via a tenancy
    const { data: tenancy, error: tErr } = await supabase
      .from('tenancies')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('landlord_id', landlordId)
      .maybeSingle();
    if (tErr || !tenancy) {
      return res.status(403).json({ message: 'Tenant not linked to your properties' });
    }

    const { data: tenantRow, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, auth_user_id')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantErr || !tenantRow) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    if (tenantRow.auth_user_id) {
      return res.status(400).json({ message: 'Tenant already has a login' });
    }

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      console.error('tenant auth creation error', createErr);
      return res.status(500).json({ message: 'Failed to create tenant login' });
    }

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({ auth_user_id: created.user.id, updated_at: new Date().toISOString() })
      .eq('id', tenantId);
    if (updateErr) {
      console.error('Failed to link auth_user_id to tenant', updateErr);
      return res.status(500).json({ message: 'Login created but failed to link tenant' });
    }

    return res.status(201).json({ message: 'Tenant login created and linked' });
  } catch (err) {
    console.error('POST /landlord/tenants/:tenantId/auth error:', err);
    return res.status(500).json({ message: 'Failed to create tenant login' });
  }
});

// GET /landlord/tenants (tenants linked to this landlord via tenancies)
landlordRouter.get('/tenants', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const { data: tenancies, error: tErr } = await supabase
      .from('tenancies')
      .select('id, tenant_id, unit_id')
      .eq('landlord_id', landlordId);
    if (tErr) throw tErr;
    if (!tenancies?.length) return res.json({ tenants: [] });

    const tenantIds = [...new Set(tenancies.map((t) => t.tenant_id).filter(Boolean))];
    const unitIds = [...new Set(tenancies.map((t) => t.unit_id).filter(Boolean))];

    let tenants = [];
    if (tenantIds.length) {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, full_name, phone, email, id_number, kra_pin, auth_user_id, status, created_at')
        .in('id', tenantIds);
      if (error) throw error;
      tenants = data || [];
    }

    let unitsById = new Map();
    if (unitIds.length) {
      const { data: units, error: uErr } = await supabase
        .from('units')
        .select('id, unit_code, property_id')
        .in('id', unitIds);
      if (uErr) throw uErr;
      unitsById = new Map((units || []).map((u) => [u.id, u]));
    }

    const propIds = [...new Set((Array.from(unitsById.values()) || []).map((u) => u.property_id).filter(Boolean))];
    let propsById = new Map();
    if (propIds.length) {
      const { data: props, error: pErr } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', propIds);
      if (pErr) throw pErr;
      propsById = new Map((props || []).map((p) => [p.id, p]));
    }

    const tenancyByTenantId = new Map();
    for (const t of tenancies) {
      tenancyByTenantId.set(t.tenant_id, t);
    }

    const formatted = tenants.map((tn) => {
      const tenancy = tenancyByTenantId.get(tn.id);
      const unit = tenancy ? unitsById.get(tenancy.unit_id) : null;
      const property = unit ? propsById.get(unit.property_id) : null;
      return {
        id: tn.id,
        fullName: tn.full_name,
        phone: tn.phone,
        email: tn.email,
        idNumber: tn.id_number,
        kraPin: tn.kra_pin,
        authUserId: tn.auth_user_id,
        status: tn.status,
        createdAt: tn.created_at,
        unitCode: unit ? unit.unit_code : null,
        propertyName: property ? property.name : null,
      };
    });

    return res.json({ tenants: formatted });
  } catch (err) {
    console.error('GET /landlord/tenants error:', err);
    return res.status(500).json({ message: 'Failed to load tenants' });
  }
});

// ----------------- Tenant Leads (approval flow) -----------------

// List leads
landlordRouter.get('/tenant-leads', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const { data, error } = await supabase
      .from('tenant_leads')
      .select('id, caretaker_id, property_id, unit_id, full_name, phone, email, notes, status, created_at')
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ leads: data || [] });
  } catch (err) {
    console.error('GET /landlord/tenant-leads error:', err);
    return res.status(500).json({ message: 'Failed to load leads' });
  }
});

// Approve lead -> create tenant + tenancy + mark unit
landlordRouter.post('/tenant-leads/:leadId/approve', async (req, res) => {
  const leadId = Number(req.params.leadId);
  if (!leadId) return res.status(400).json({ message: 'leadId required' });
  const landlordId = req.landlordId;
  try {
    const { data: lead, error: leadErr } = await supabase
      .from('tenant_leads')
      .select('*')
      .eq('id', leadId)
      .eq('landlord_id', landlordId)
      .maybeSingle();
    if (leadErr || !lead) return res.status(404).json({ message: 'Lead not found' });

    let unit = null;
    if (lead.unit_id) {
      const { data: unitRow, error: unitErr } = await supabase
        .from('units')
        .select('id, status, base_rent, waste_fee')
        .eq('id', lead.unit_id)
        .maybeSingle();
      if (unitErr || !unitRow) {
        return res.status(400).json({ message: 'Unit not found for lead' });
      }
      if (unitRow.status !== 'vacant') {
        return res.status(400).json({ message: 'Unit is not vacant' });
      }
      unit = unitRow;
    }

    // create tenant
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .insert({
        full_name: lead.full_name,
        phone: lead.phone,
        email: lead.email,
        status: 'active',
      })
      .select('id')
      .single();
    if (tErr) throw tErr;

    let tenancyId = null;
    if (lead.unit_id) {
      const { data: tenancy, error: tenErr } = await supabase
        .from('tenancies')
        .insert({
          tenant_id: tenant.id,
          unit_id: lead.unit_id,
          landlord_id: landlordId,
          start_date: new Date().toISOString().slice(0, 10),
          rent_amount: unit ? Number(unit.base_rent || 0) : 0,
          status: 'active',
        })
        .select('id, billing_day')
        .single();
      if (tenErr) throw tenErr;
      tenancyId = tenancy.id;
      await supabase.from('units').update({ status: 'occupied', updated_at: new Date().toISOString() }).eq('id', lead.unit_id);

      await ensureWalletAndInitialBill({
        tenancyId,
        landlordId,
        rentAmount: unit ? Number(unit.base_rent || 0) : 0,
        wasteAmount: unit ? Number(unit.waste_fee || 0) : 0,
        billingDay: tenancy.billing_day || 1,
      });
    }

    await supabase
      .from('tenant_leads')
      .update({ status: 'approved', tenant_id: tenant.id, tenancy_id: tenancyId })
      .eq('id', leadId);

    return res.json({ message: 'Lead approved', tenantId: tenant.id, tenancyId });
  } catch (err) {
    console.error('POST /landlord/tenant-leads/:leadId/approve error:', err);
    return res.status(500).json({ message: 'Failed to approve lead' });
  }
});

landlordRouter.post('/tenant-leads/:leadId/reject', async (req, res) => {
  const leadId = Number(req.params.leadId);
  if (!leadId) return res.status(400).json({ message: 'leadId required' });
  const landlordId = req.landlordId;
  try {
    const { error } = await supabase
      .from('tenant_leads')
      .update({ status: 'rejected' })
      .eq('id', leadId)
      .eq('landlord_id', landlordId);
    if (error) throw error;
    return res.json({ message: 'Lead rejected' });
  } catch (err) {
    console.error('POST /landlord/tenant-leads/:leadId/reject error:', err);
    return res.status(500).json({ message: 'Failed to reject lead' });
  }
});

// --- CARETAKERS MANAGEMENT ---

// GET /landlord/caretakers
landlordRouter.get('/caretakers', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const { data: caretakers, error: cErr } = await supabase
      .from('caretakers')
      .select('id, full_name, phone, email, auth_user_id, status, created_at')
      .eq('landlord_id', landlordId);
    if (cErr) throw cErr;

    const caretakerIds = caretakers.map((c) => c.id);
    let assignments = [];
    if (caretakerIds.length) {
      const { data: cp, error: cpErr } = await supabase
        .from('caretaker_properties')
        .select('caretaker_id, property_id')
        .in('caretaker_id', caretakerIds);
      if (cpErr) throw cpErr;
      assignments = cp || [];
    }
    const propIds = [...new Set(assignments.map((a) => a.property_id))];
    let propsById = new Map();
    if (propIds.length) {
      const { data: props, error: pErr } = await supabase.from('properties').select('id, name').in('id', propIds);
      if (pErr) throw pErr;
      propsById = new Map(props.map((p) => [p.id, p]));
    }

    const formatted = caretakers.map((c) => {
      const props = assignments.filter((a) => a.caretaker_id === c.id).map((a) => propsById.get(a.property_id)?.name).filter(Boolean);
      return {
        id: c.id,
        fullName: c.full_name,
        phone: c.phone,
        email: c.email,
        status: c.status,
        authUserId: c.auth_user_id,
        properties: props,
        createdAt: c.created_at,
      };
    });
    return res.json({ caretakers: formatted });
  } catch (err) {
    console.error('GET /landlord/caretakers error:', err);
    return res.status(500).json({ message: 'Failed to load caretakers' });
  }
});

// POST /landlord/caretakers
landlordRouter.post('/caretakers', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const { fullName, phone, email, propertyIds = [] } = req.body || {};
    if (!fullName || !phone) {
      return res.status(400).json({ message: 'fullName and phone are required' });
    }

    const { data: caretaker, error } = await supabase
      .from('caretakers')
      .insert({
        landlord_id: landlordId,
        full_name: fullName,
        phone,
        email: email || null,
        status: 'active',
      })
      .select('id, full_name, phone, email, status')
      .single();
    if (error) {
      console.error('create caretaker error', error);
      return res.status(500).json({ message: 'Failed to create caretaker' });
    }

    if (propertyIds.length) {
      const { data: props, error: propsErr } = await supabase.from('properties').select('id').eq('landlord_id', landlordId);
      if (!propsErr && props?.length) {
        const allowed = new Set(props.map((p) => p.id));
        const rows = propertyIds.filter((id) => allowed.has(Number(id))).map((id) => ({ caretaker_id: caretaker.id, property_id: Number(id) }));
        if (rows.length) {
          const { error: cpErr } = await supabase.from('caretaker_properties').insert(rows);
          if (cpErr) console.error('assign caretaker properties error', cpErr);
        }
      }
    }

    return res.status(201).json({ message: 'Caretaker created', caretaker });
  } catch (err) {
    console.error('POST /landlord/caretakers error:', err);
    return res.status(500).json({ message: 'Failed to create caretaker' });
  }
});

// DELETE /landlord/caretakers/:id
landlordRouter.delete('/caretakers/:id', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const caretakerId = Number(req.params.id);
    if (!caretakerId) return res.status(400).json({ message: 'caretakerId required' });

    const { data: ct, error: ctErr } = await supabase
      .from('caretakers')
      .select('id')
      .eq('id', caretakerId)
      .eq('landlord_id', landlordId)
      .maybeSingle();
    if (ctErr || !ct) return res.status(404).json({ message: 'Caretaker not found' });

    await supabase.from('caretaker_properties').delete().eq('caretaker_id', caretakerId);
    const { error: delErr } = await supabase.from('caretakers').delete().eq('id', caretakerId);
    if (delErr) {
      console.error('delete caretaker error', delErr);
      return res.status(500).json({ message: 'Failed to delete caretaker' });
    }
    return res.json({ message: 'Caretaker deleted' });
  } catch (err) {
    console.error('DELETE /landlord/caretakers error:', err);
    return res.status(500).json({ message: 'Failed to delete caretaker' });
  }
});

// POST /landlord/caretakers/:id/auth
landlordRouter.post('/caretakers/:id/auth', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const caretakerId = Number(req.params.id);
    const { email, password } = req.body || {};
    if (!caretakerId || !email || !password) {
      return res.status(400).json({ message: 'caretakerId, email and password are required' });
    }

    const { data: ct, error: ctErr } = await supabase
      .from('caretakers')
      .select('id, auth_user_id')
      .eq('id', caretakerId)
      .eq('landlord_id', landlordId)
      .maybeSingle();
    if (ctErr || !ct) return res.status(404).json({ message: 'Caretaker not found' });
    if (ct.auth_user_id) return res.status(400).json({ message: 'Caretaker already has a login' });

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      console.error('caretaker auth creation error', createErr);
      return res.status(500).json({ message: 'Failed to create caretaker login' });
    }

    const { error: linkErr } = await supabase
      .from('caretakers')
      .update({ auth_user_id: created.user.id, updated_at: new Date().toISOString() })
      .eq('id', caretakerId);
    if (linkErr) {
      console.error('failed to link caretaker auth_user_id', linkErr);
      return res.status(500).json({ message: 'Login created but failed to link caretaker' });
    }

    return res.status(201).json({ message: 'Caretaker login created' });
  } catch (err) {
    console.error('POST /landlord/caretakers/:id/auth error:', err);
      return res.status(500).json({ message: 'Failed to create caretaker login' });
  }
});

// --- Ticket messages (landlord side) ---
landlordRouter.get('/tickets/:ticketId/messages', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const ticketId = Number(req.params.ticketId);
    if (!ticketId) return res.status(400).json({ message: 'ticketId required' });

    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, property_id, landlord_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketErr || !ticket || ticket.landlord_id !== landlordId) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const { data: messages, error } = await supabase
      .from('ticket_messages')
      .select('id, sender_type, sender_id, message, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return res.json({ messages: messages || [] });
  } catch (err) {
    console.error('GET /landlord/tickets/:ticketId/messages error:', err);
    return res.status(500).json({ message: 'Failed to load messages' });
  }
});

landlordRouter.post('/tickets/:ticketId/messages', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const ticketId = Number(req.params.ticketId);
    const { message } = req.body || {};
    if (!ticketId || !message) {
      return res.status(400).json({ message: 'ticketId and message are required' });
    }

    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, landlord_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketErr || !ticket || ticket.landlord_id !== landlordId) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_type: 'landlord',
      sender_id: landlordId,
      message,
    });
    if (error) throw error;

    return res.status(201).json({ message: 'Message added' });
  } catch (err) {
    console.error('POST /landlord/tickets/:ticketId/messages error:', err);
    return res.status(500).json({ message: 'Failed to add message' });
  }
});

// -------- Announcements --------
landlordRouter.get('/announcements', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const propertyId = req.query.propertyId ? Number(req.query.propertyId) : null;
    const unitId = req.query.unitId ? Number(req.query.unitId) : null;

    let query = supabase
      .from('announcements')
      .select('id, title, message, target_type, property_id, unit_id, tenant_id, visible_from, visible_to, created_at')
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: false });

    if (propertyId) query = query.eq('property_id', propertyId);
    if (unitId) query = query.eq('unit_id', unitId);

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ announcements: data || [] });
  } catch (err) {
    console.error('GET /landlord/announcements error:', err);
    return res.status(500).json({ message: 'Failed to load announcements' });
  }
});

landlordRouter.post('/announcements', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const { title, message, targetType = 'property', propertyId = null, unitId = null, tenantId = null, visibleFrom = null, visibleTo = null } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ message: 'title and message are required' });
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        landlord_id: landlordId,
        title,
        message,
        target_type: targetType,
        property_id: propertyId,
        unit_id: unitId,
        tenant_id: tenantId,
        visible_from: visibleFrom || new Date().toISOString(),
        visible_to: visibleTo || null,
      })
      .select('id, title, message, target_type, property_id, unit_id, tenant_id, visible_from, visible_to, created_at')
      .single();

    if (error) {
      console.error('create announcement error', error);
      return res.status(500).json({ message: 'Failed to create announcement' });
    }

    return res.status(201).json({ message: 'Announcement created', announcement: data });
  } catch (err) {
    console.error('POST /landlord/announcements error:', err);
    return res.status(500).json({ message: 'Failed to create announcement' });
  }
});

// -------- Public Listings / Applications --------
landlordRouter.get('/public-listings', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const { data: props, error: propsErr } = await supabase.from('properties').select('id').eq('landlord_id', landlordId);
    if (propsErr) throw propsErr;
    const propertyIds = props?.map((p) => p.id) || [];
    if (!propertyIds.length) return res.json({ listings: [] });

    const { data: listings, error } = await supabase
      .from('public_listings')
      .select('id, unit_id, property_id, title, description, rent_amount, photos, is_active, listed_at, removed_at')
      .eq('is_active', true)
      .in('property_id', propertyIds)
      .order('listed_at', { ascending: false });

    if (error) throw error;
    return res.json({ listings: listings || [] });
  } catch (err) {
    console.error('GET /landlord/public-listings error:', err);
    return res.status(500).json({ message: 'Failed to load listings' });
  }
});

landlordRouter.post('/public-listings', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const { unitId, title, description, rentAmount, photos = null } = req.body || {};
    if (!unitId || !title || rentAmount == null) {
      return res.status(400).json({ message: 'unitId, title, rentAmount are required' });
    }

    const { data: unit, error: unitErr } = await supabase
      .from('units')
      .select('id, property_id, base_rent')
      .eq('id', unitId)
      .single();
    if (unitErr || !unit) return res.status(404).json({ message: 'Unit not found' });

    const { data: property, error: propErr } = await supabase
      .from('properties')
      .select('id')
      .eq('id', unit.property_id)
      .eq('landlord_id', landlordId)
      .maybeSingle();
    if (propErr || !property) return res.status(403).json({ message: 'Unit not under your properties' });

    const { data: listing, error: listErr } = await supabase
      .from('public_listings')
      .insert({
        unit_id: unit.id,
        property_id: unit.property_id,
        title,
        description: description || '',
        rent_amount: rentAmount,
        photos,
        is_active: true,
        listed_at: new Date().toISOString(),
      })
      .select('id, unit_id, property_id, title, description, rent_amount, is_active, listed_at')
      .single();

    if (listErr) throw listErr;
    return res.status(201).json({ message: 'Listing created', listing });
  } catch (err) {
    console.error('POST /landlord/public-listings error:', err);
    return res.status(500).json({ message: 'Failed to create listing' });
  }
});

landlordRouter.post('/public-listings/:id/archive', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const listingId = Number(req.params.id);
    const { data: listing, error: listingErr } = await supabase
      .from('public_listings')
      .select('id, property_id, is_active')
      .eq('id', listingId)
      .maybeSingle();
    if (listingErr || !listing) return res.status(404).json({ message: 'Listing not found' });

    const { data: property, error: propErr } = await supabase
      .from('properties')
      .select('id')
      .eq('id', listing.property_id)
      .eq('landlord_id', landlordId)
      .maybeSingle();
    if (propErr || !property) return res.status(403).json({ message: 'Not allowed' });

    const { error: updateErr } = await supabase
      .from('public_listings')
      .update({ is_active: false, removed_at: new Date().toISOString() })
      .eq('id', listingId);
    if (updateErr) throw updateErr;
    return res.json({ message: 'Listing archived' });
  } catch (err) {
    console.error('POST /landlord/public-listings/:id/archive error:', err);
    return res.status(500).json({ message: 'Failed to archive listing' });
  }
});

landlordRouter.get('/applications', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const status = req.query.status ? req.query.status.toString() : null;

    const { data: props, error: propsErr } = await supabase
      .from('properties')
      .select('id')
      .eq('landlord_id', landlordId);
    if (propsErr) throw propsErr;
    const propertyIds = props?.map((p) => p.id) || [];
    if (!propertyIds.length) return res.json({ applications: [] });

    let query = supabase
      .from('applications')
      .select('id, property_id, unit_id, full_name, phone, email, employment_info, monthly_income, status, created_at')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ applications: data || [] });
  } catch (err) {
    console.error('GET /landlord/applications error:', err);
    return res.status(500).json({ message: 'Failed to load applications' });
  }
});

// -------- Documents --------
landlordRouter.get('/documents', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const tenancyId = req.query.tenancyId ? Number(req.query.tenancyId) : null;

    let tenancyQuery = supabase.from('tenancies').select('id').eq('landlord_id', landlordId);
    if (tenancyId) tenancyQuery = tenancyQuery.eq('id', tenancyId);
    const { data: tenancies, error: tErr } = await tenancyQuery;
    if (tErr) throw tErr;
    const tenancyIds = tenancies?.map((t) => t.id) || [];
    if (!tenancyIds.length) return res.json({ documents: [] });

    const { data, error } = await supabase
      .from('documents')
      .select('id, tenancy_id, tenant_id, type, file_url, uploaded_by, uploaded_at')
      .in('tenancy_id', tenancyIds)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return res.json({ documents: data || [] });
  } catch (err) {
    console.error('GET /landlord/documents error:', err);
    return res.status(500).json({ message: 'Failed to load documents' });
  }
});

landlordRouter.post('/documents', async (req, res) => {
  try {
    const landlordId = req.landlordId;
    const { tenancyId, tenantId = null, type, fileUrl, uploadedBy = 'landlord' } = req.body || {};
    if (!tenancyId || !type || !fileUrl) {
      return res.status(400).json({ message: 'tenancyId, type, fileUrl are required' });
    }

    const { data: tenancy, error: tErr } = await supabase
      .from('tenancies')
      .select('id')
      .eq('id', tenancyId)
      .eq('landlord_id', landlordId)
      .maybeSingle();
    if (tErr || !tenancy) return res.status(403).json({ message: 'Tenancy not found for landlord' });

    const { data, error } = await supabase
      .from('documents')
      .insert({
        tenancy_id: tenancyId,
        tenant_id: tenantId || null,
        type,
        file_url: fileUrl,
        uploaded_by: uploadedBy,
      })
      .select('id, tenancy_id, tenant_id, type, file_url, uploaded_by, uploaded_at')
      .single();
    if (error) throw error;

    return res.status(201).json({ message: 'Document saved', document: data });
  } catch (err) {
    console.error('POST /landlord/documents error:', err);
    return res.status(500).json({ message: 'Failed to save document' });
  }
});
