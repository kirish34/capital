import { supabase } from './supabaseClient.js';

function getCurrentBillingPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`; // YYYY-MM
}

/**
 * Aggregate landlord dashboard data.
 * @param {Object} params
 * @param {number} params.landlordId - required
 * @param {number|null} [params.propertyId] - optional filter
 * @param {string|null} [params.billingPeriod] - "YYYY-MM", defaults to current month
 */
export async function getLandlordDashboard({ landlordId, propertyId = null, billingPeriod = null }) {
  if (!landlordId) throw new Error('landlordId is required');
  if (!billingPeriod) {
    billingPeriod = getCurrentBillingPeriod();
  }

  // 1) Properties for landlord
  const { data: properties, error: propsError } = await supabase
    .from('properties')
    .select('id, name')
    .eq('landlord_id', landlordId);

  if (propsError) {
    console.error('Dashboard: error fetching properties', propsError);
    throw new Error('Failed to load properties');
  }

  if (!properties || properties.length === 0) {
    return {
      landlordId,
      billingPeriod,
      summary: {
        totalUnits: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        expectedThisMonth: 0,
        collectedThisMonth: 0,
        outstandingThisMonth: 0,
        overdueCount: 0,
        openTicketsCount: 0,
      },
      properties: [],
      overdueBills: [],
      recentPayments: [],
      openTickets: [],
      vacateRequests: [],
    };
  }

  const allPropertyIds = properties.map((p) => p.id);
  const normalizedPropertyId = propertyId ? Number(propertyId) : null;
  const filteredPropertyIds =
    normalizedPropertyId && allPropertyIds.includes(normalizedPropertyId)
      ? [normalizedPropertyId]
      : allPropertyIds;

  // 2) Units in selected properties
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, property_id, unit_code, status')
    .in('property_id', filteredPropertyIds);

  if (unitsError) {
    console.error('Dashboard: error fetching units', unitsError);
    throw new Error('Failed to load units');
  }

  const unitIds = units.map((u) => u.id);

  // 3) Tenancies for landlord (filter by unit/property later)
  const { data: tenancies, error: tenanciesError } = await supabase
    .from('tenancies')
    .select('id, tenant_id, unit_id, status')
    .eq('landlord_id', landlordId);

  if (tenanciesError) {
    console.error('Dashboard: error fetching tenancies', tenanciesError);
    throw new Error('Failed to load tenancies');
  }

  const tenancyMapById = new Map();
  const tenancyIds = [];
  const tenantIdsSet = new Set();

  for (const t of tenancies) {
    if (!unitIds.includes(t.unit_id)) continue;
    tenancyMapById.set(t.id, t);
    tenancyIds.push(t.id);
    tenantIdsSet.add(t.tenant_id);
  }

  // 4) Tenants for names/contacts
  let tenantsById = new Map();
  if (tenantIdsSet.size > 0) {
    const tenantIds = Array.from(tenantIdsSet);
    const { data: tenantsData, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, full_name, phone')
      .in('id', tenantIds);

    if (tenantsError) {
      console.error('Dashboard: error fetching tenants', tenantsError);
      throw new Error('Failed to load tenants');
    }

    tenantsById = new Map(tenantsData.map((t) => [t.id, t]));
  }

  // 5) Bills for billing period across tenancyIds
  let bills = [];
  if (tenancyIds.length > 0) {
    const { data: billsData, error: billsError } = await supabase
      .from('bills')
      .select('id, tenancy_id, billing_period, total_amount, amount_paid, status, due_date, rent_amount, water_amount, waste_amount')
      .eq('billing_period', billingPeriod)
      .in('tenancy_id', tenancyIds);

    if (billsError) {
      console.error('Dashboard: error fetching bills', billsError);
      throw new Error('Failed to load bills');
    }

    bills = billsData || [];
  }

  const billIds = bills.map((b) => b.id);

  // 5b) Wallets for these tenancies
  let walletsByTenancyId = new Map();
  if (tenancyIds.length > 0) {
    const { data: walletsData, error: walletsError } = await supabase
      .from('wallet_accounts')
      .select('id, tenancy_id, account_reference, balance')
      .in('tenancy_id', tenancyIds);
    if (walletsError) {
      console.error('Dashboard: error fetching wallets', walletsError);
      throw new Error('Failed to load wallets');
    }
    walletsByTenancyId = new Map((walletsData || []).map((w) => [w.tenancy_id, w]));
  }

  // 6) Payments for those bills (successful)
  let payments = [];
  if (billIds.length > 0) {
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('id, bill_id, tenancy_id, amount, method, status, paid_at')
      .in('bill_id', billIds)
      .eq('status', 'successful')
      .order('paid_at', { ascending: false })
      .limit(20);

    if (paymentsError) {
      console.error('Dashboard: error fetching payments', paymentsError);
      throw new Error('Failed to load payments');
    }

    payments = paymentsData || [];
  }

  // 7) Tickets for filtered properties
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('id, title, status, priority, created_at, property_id, unit_id')
    .in('property_id', filteredPropertyIds)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (ticketsError) {
    console.error('Dashboard: error fetching tickets', ticketsError);
    throw new Error('Failed to load tickets');
  }

  // 8) Vacate requests for these tenancies
  let vacateRequests = [];
  if (tenancyIds.length > 0) {
    const { data: vacatesData, error: vacatesError } = await supabase
      .from('vacate_requests')
      .select('id, tenancy_id, tenant_id, requested_move_out_date, status, created_at')
      .in('tenancy_id', tenancyIds)
      .in('status', ['pending', 'approved'])
      .order('requested_move_out_date', { ascending: true });

    if (vacatesError) {
      console.error('Dashboard: error fetching vacate requests', vacatesError);
      throw new Error('Failed to load vacate requests');
    }

    vacateRequests = vacatesData || [];
  }

  // 9) Build quick lookup maps
  const unitsById = new Map(units.map((u) => [u.id, u]));
  const propertiesById = new Map(properties.map((p) => [p.id, p]));

  // 10) Summary stats
  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => u.status === 'occupied').length;
  const vacantUnits = units.filter((u) => u.status === 'vacant').length;

  let expectedThisMonth = 0;
  let outstandingThisMonth = 0;
  let overdueCount = 0;
  for (const b of bills) {
    expectedThisMonth += Number(b.total_amount);
    const remaining = Number(b.total_amount) - Number(b.amount_paid);
    if (remaining > 0) outstandingThisMonth += remaining;
    if (b.status === 'overdue') overdueCount++;
  }

  let collectedThisMonth = 0;
  for (const p of payments) {
    collectedThisMonth += Number(p.amount);
  }

  const openTicketsCount = tickets.length;

  // 11) Property stats
  const propertyStats = properties
    .filter((p) => filteredPropertyIds.includes(p.id))
    .map((p) => {
      const propUnits = units.filter((u) => u.property_id === p.id);
      const propTotal = propUnits.length;
      const propOccupied = propUnits.filter((u) => u.status === 'occupied').length;
      const propVacant = propUnits.filter((u) => u.status === 'vacant').length;
      const occupancyPercent = propTotal > 0 ? Math.round((propOccupied * 100) / propTotal) : 0;

      return {
        id: p.id,
        name: p.name,
        totalUnits: propTotal,
        occupiedUnits: propOccupied,
        vacantUnits: propVacant,
        occupancyPercent,
      };
    });

  // 12) Overdue / unpaid / partial bills table
  const overdueBills = bills
    .filter((b) => ['unpaid', 'partial', 'overdue'].includes(b.status))
    .map((b) => {
      const tenancy = tenancyMapById.get(b.tenancy_id);
      const tenant = tenancy ? tenantsById.get(tenancy.tenant_id) : null;
      const unit = tenancy ? unitsById.get(tenancy.unit_id) : null;
      const property = unit ? propertiesById.get(unit.property_id) : null;
      const balance = Number(b.total_amount) - Number(b.amount_paid);

      return {
        id: b.id,
        billingPeriod: b.billing_period,
        totalAmount: Number(b.total_amount),
        amountPaid: Number(b.amount_paid),
        balance,
        status: b.status,
        dueDate: b.due_date,
        tenantName: tenant ? tenant.full_name : null,
        tenantPhone: tenant ? tenant.phone : null,
        unitCode: unit ? unit.unit_code : null,
        propertyName: property ? property.name : null,
        rentAmount: Number(b.rent_amount || 0),
        waterAmount: Number(b.water_amount || 0),
        wasteAmount: Number(b.waste_amount || 0),
      };
    });

  // 13) Recent payments table
  const recentPayments = payments.map((p) => {
    const bill = bills.find((b) => b.id === p.bill_id);
    const tenancy = tenancyMapById.get(p.tenancy_id);
    const tenant = tenancy ? tenantsById.get(tenancy.tenant_id) : null;
    const unit = tenancy ? unitsById.get(tenancy.unit_id) : null;
    const property = unit ? propertiesById.get(unit.property_id) : null;

    return {
      id: p.id,
      amount: Number(p.amount),
      paidAt: p.paid_at,
      method: p.method,
      billingPeriod: bill ? bill.billing_period : null,
      tenantName: tenant ? tenant.full_name : null,
      unitCode: unit ? unit.unit_code : null,
      propertyName: property ? property.name : null,
    };
  });

  // 14) Open tickets
  const openTickets = tickets.map((t) => {
    const unit = t.unit_id ? unitsById.get(t.unit_id) : null;
    const property = t.property_id ? propertiesById.get(t.property_id) : null;

    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      createdAt: t.created_at,
      unitCode: unit ? unit.unit_code : null,
      propertyName: property ? property.name : null,
    };
  });

  // 15) Vacate requests
  const vacateRequestsFormatted = vacateRequests.map((v) => {
    const tenancy = tenancyMapById.get(v.tenancy_id);
    const tenant = tenantsById.get(v.tenant_id);
    const unit = tenancy ? unitsById.get(tenancy.unit_id) : null;
    const property = unit ? propertiesById.get(unit.property_id) : null;

    return {
      id: v.id,
      requestedMoveOutDate: v.requested_move_out_date,
      status: v.status,
      createdAt: v.created_at,
      tenantName: tenant ? tenant.full_name : null,
      unitCode: unit ? unit.unit_code : null,
      propertyName: property ? property.name : null,
    };
  });

  // 16) Tenancies overview (for units tab with wallet info)
  const tenanciesOverview = Array.from(tenancyMapById.values()).map((t) => {
    const tenant = tenantsById.get(t.tenant_id);
    const unit = unitsById.get(t.unit_id);
    const property = unit ? propertiesById.get(unit.property_id) : null;
    const wallet = walletsByTenancyId.get(t.id);
    return {
      id: t.id,
      status: t.status,
      tenantName: tenant ? tenant.full_name : null,
      tenantPhone: tenant ? tenant.phone : null,
      unitCode: unit ? unit.unit_code : null,
      propertyName: property ? property.name : null,
      walletAccount: wallet ? wallet.account_reference : null,
      walletBalance: wallet ? Number(wallet.balance) : 0,
    };
  });

  return {
    landlordId,
    billingPeriod,
    summary: {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      expectedThisMonth,
      collectedThisMonth,
      outstandingThisMonth,
      overdueCount,
      openTicketsCount,
    },
    properties: propertyStats,
    overdueBills,
    recentPayments,
    openTickets,
    vacateRequests: vacateRequestsFormatted,
    tenancies: tenanciesOverview,
  };
}
