import express from 'express';
import { supabase } from './supabaseClient.js';
import { requireTenant } from './authMiddleware.js';

export const tenantRouter = express.Router();
tenantRouter.use(requireTenant);

/**
 * GET /tenant/overview?tenantId=
 * Tenant home screen: active tenancies + wallet + latest bill
 */
tenantRouter.get('/overview', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const { data: tenancies, error: tenanciesError } = await supabase
      .from('tenancies')
      .select('id, unit_id, landlord_id, start_date, status, rent_amount')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'pending_move_in']);

    if (tenanciesError) throw tenanciesError;

    if (!tenancies || tenancies.length === 0) {
      return res.json({
        tenantId,
        tenancies: [],
      });
    }

    const tenancyIds = tenancies.map((t) => t.id);
    const unitIds = tenancies.map((t) => t.unit_id);
    const landlordIds = [...new Set(tenancies.map((t) => t.landlord_id))];

    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, unit_code, type, property_id')
      .in('id', unitIds);

    if (unitsError) throw unitsError;

    const propertyIds = [...new Set(units.map((u) => u.property_id))];
    const { data: properties, error: propsError } = await supabase
      .from('properties')
      .select('id, name, location')
      .in('id', propertyIds);

    if (propsError) throw propsError;

    const { data: landlords, error: lError } = await supabase
      .from('landlords')
      .select('id, name, phone, paybill_id')
      .in('id', landlordIds);

    if (lError) throw lError;

    const unitsById = new Map(units.map((u) => [u.id, u]));
    const propsById = new Map(properties.map((p) => [p.id, p]));
    const landlordsById = new Map(landlords.map((l) => [l.id, l]));

    const { data: wallets, error: walletsError } = await supabase
      .from('wallet_accounts')
      .select('id, tenancy_id, account_reference, balance, status, paybill_id')
      .in('tenancy_id', tenancyIds);

    if (walletsError) throw walletsError;
    const walletByTenancyId = new Map(wallets.map((w) => [w.tenancy_id, w]));

    const paybillIds = new Set();
    for (const w of wallets) {
      if (w.paybill_id) paybillIds.add(w.paybill_id);
    }
    for (const l of landlords) {
      if (l.paybill_id) paybillIds.add(l.paybill_id);
    }

    let paybillById = new Map();
    if (paybillIds.size > 0) {
      const { data: paybills, error: paybillError } = await supabase
        .from('paybills')
        .select('id, shortcode, name, account_type, is_active')
        .in('id', Array.from(paybillIds));
      if (paybillError) throw paybillError;
      paybillById = new Map(paybills.map((p) => [p.id, p]));
    }

    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('id, tenancy_id, billing_period, total_amount, amount_paid, status, due_date')
      .in('tenancy_id', tenancyIds)
      .order('billing_period', { ascending: false });

    if (billsError) throw billsError;

    const latestBillByTenancyId = new Map();
    for (const b of bills) {
      if (!latestBillByTenancyId.has(b.tenancy_id)) {
        latestBillByTenancyId.set(b.tenancy_id, b);
      }
    }

    const formattedTenancies = tenancies.map((t) => {
      const unit = unitsById.get(t.unit_id);
      const property = unit ? propsById.get(unit.property_id) : null;
      const landlord = landlordsById.get(t.landlord_id);
      const wallet = walletByTenancyId.get(t.id) || null;
      const paybill =
        wallet?.paybill_id
          ? paybillById.get(wallet.paybill_id) || null
          : landlord?.paybill_id
            ? paybillById.get(landlord.paybill_id) || null
            : null;
      const bill = latestBillByTenancyId.get(t.id) || null;
      const billBalance = bill ? Number(bill.total_amount) - Number(bill.amount_paid) : null;

      return {
        id: t.id,
        status: t.status,
        startDate: t.start_date,
        rentAmount: Number(t.rent_amount),
        unit: unit
          ? {
              id: unit.id,
              code: unit.unit_code,
              type: unit.type,
            }
          : null,
        property: property
          ? {
              id: property.id,
              name: property.name,
              location: property.location,
            }
          : null,
        landlord: landlord
          ? {
              id: landlord.id,
              name: landlord.name,
              phone: landlord.phone,
            }
          : null,
        wallet: wallet
          ? {
              id: wallet.id,
              accountReference: wallet.account_reference,
              balance: Number(wallet.balance),
              status: wallet.status,
              paybill: paybill
                ? {
                    id: paybill.id,
                    shortcode: paybill.shortcode,
                    name: paybill.name,
                  }
                : null,
            }
          : null,
        latestBill: bill
          ? {
              id: bill.id,
              billingPeriod: bill.billing_period,
              totalAmount: Number(bill.total_amount),
              amountPaid: Number(bill.amount_paid),
              balance: billBalance,
              status: bill.status,
              dueDate: bill.due_date,
            }
          : null,
      };
    });

    return res.json({
      tenantId,
      tenancies: formattedTenancies,
    });
  } catch (err) {
    console.error('GET /tenant/overview error:', err);
    return res.status(500).json({ message: 'Failed to load tenant overview' });
  }
});

/**
 * GET /tenant/bills?tenantId=
 * All bills (across tenancies) for this tenant
 */
tenantRouter.get('/bills', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const { data: tenancies, error: tenanciesError } = await supabase
      .from('tenancies')
      .select('id, unit_id')
      .eq('tenant_id', tenantId);

    if (tenanciesError) throw tenanciesError;
    if (!tenancies || tenancies.length === 0) return res.json({ bills: [] });

    const tenancyIds = tenancies.map((t) => t.id);
    const unitIds = tenancies.map((t) => t.unit_id);

    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, unit_code, property_id')
      .in('id', unitIds);

    if (unitsError) throw unitsError;

    const propertyIds = [...new Set(units.map((u) => u.property_id))];
    let properties = [];
    if (propertyIds.length) {
      const { data: propsData, error: propsError } = await supabase
        .from('properties')
        .select('id, name, location')
        .in('id', propertyIds);

      if (propsError) throw propsError;
      properties = propsData || [];
    }

    const unitsById = new Map(units.map((u) => [u.id, u]));
    const propsById = new Map(properties.map((p) => [p.id, p]));

    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('id, tenancy_id, billing_period, total_amount, amount_paid, status, due_date')
      .in('tenancy_id', tenancyIds)
      .order('billing_period', { ascending: false });

    if (billsError) throw billsError;

    const formatted = bills.map((b) => {
      const tenancy = tenancies.find((t) => t.id === b.tenancy_id);
      const unit = tenancy ? unitsById.get(tenancy.unit_id) : null;
      const property = unit ? propsById.get(unit.property_id) : null;
      const balance = Number(b.total_amount) - Number(b.amount_paid);

      return {
        id: b.id,
        billingPeriod: b.billing_period,
        totalAmount: Number(b.total_amount),
        amountPaid: Number(b.amount_paid),
        balance,
        status: b.status,
        dueDate: b.due_date,
        unitCode: unit?.unit_code || null,
        propertyName: property?.name || null,
      };
    });

    return res.json({ bills: formatted });
  } catch (err) {
    console.error('GET /tenant/bills error:', err);
    return res.status(500).json({ message: 'Failed to load bills' });
  }
});

/**
 * GET /tenant/tickets?tenantId=
 * Issues raised by this tenant
 */
tenantRouter.get('/tickets', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, title, description, status, priority, created_at, property_id, unit_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (ticketsError) throw ticketsError;
    if (!tickets || tickets.length === 0) return res.json({ tickets: [] });

    const propertyIds = [...new Set(tickets.map((t) => t.property_id).filter(Boolean))];
    const unitIds = [...new Set(tickets.map((t) => t.unit_id).filter(Boolean))];

    let properties = [];
    let units = [];

    if (propertyIds.length) {
      const { data: propsData, error: propsError } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', propertyIds);

      if (propsError) throw propsError;
      properties = propsData || [];
    }

    if (unitIds.length) {
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_code')
        .in('id', unitIds);

      if (unitsError) throw unitsError;
      units = unitsData || [];
    }

    const propsById = new Map(properties.map((p) => [p.id, p]));
    const unitsById = new Map(units.map((u) => [u.id, u]));

    const formatted = tickets.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      createdAt: t.created_at,
      propertyName: t.property_id ? propsById.get(t.property_id)?.name || null : null,
      unitCode: t.unit_id ? unitsById.get(t.unit_id)?.unit_code || null : null,
    }));

    return res.json({ tickets: formatted });
  } catch (err) {
    console.error('GET /tenant/tickets error:', err);
    return res.status(500).json({ message: 'Failed to load tickets' });
  }
});

/**
 * POST /tenant/tickets
 * Body: { tenantId, tenancyId, title, description, category, priority }
 */
tenantRouter.post('/tickets', async (req, res) => {
  try {
    const { tenancyId, title, description, category, priority } = req.body || {};
    const tenantId = req.tenantId;

    if (!tenantId || !tenancyId || !title) {
      return res.status(400).json({ message: 'tenancyId and title are required' });
    }

    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select('id, unit_id, landlord_id, tenant_id')
      .eq('id', tenancyId)
      .maybeSingle();

    if (tenancyError || !tenancy) {
      return res.status(404).json({ message: 'Tenancy not found' });
    }

    if (tenancy.tenant_id !== tenantId) {
      return res.status(403).json({ message: 'Tenancy not linked to this tenant' });
    }

    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, property_id')
      .eq('id', tenancy.unit_id)
      .maybeSingle();

    if (unitError || !unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    const { data: ticketInsert, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        tenant_id: tenantId,
        tenancy_id: tenancyId,
        property_id: unit.property_id,
        unit_id: unit.id,
        title,
        description: description || '',
        category: category || 'general',
        status: 'open',
        priority: priority || 'medium',
        created_by: 'tenant',
      })
      .select('id')
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      return res.status(500).json({ message: 'Failed to create ticket' });
    }

    return res.status(201).json({ message: 'Ticket created', ticketId: ticketInsert.id });
  } catch (err) {
    console.error('POST /tenant/tickets error:', err);
    return res.status(500).json({ message: 'Failed to create ticket' });
  }
});

// Ticket messages (tenant side)
tenantRouter.get('/tickets/:ticketId/messages', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const ticketId = Number(req.params.ticketId);
    if (!ticketId) return res.status(400).json({ message: 'ticketId required' });

    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, tenant_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketErr || !ticket || ticket.tenant_id !== tenantId) {
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
    console.error('GET /tenant/tickets/:ticketId/messages error:', err);
    return res.status(500).json({ message: 'Failed to load messages' });
  }
});

tenantRouter.post('/tickets/:ticketId/messages', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const ticketId = Number(req.params.ticketId);
    const { message } = req.body || {};
    if (!ticketId || !message) {
      return res.status(400).json({ message: 'ticketId and message are required' });
    }

    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, tenant_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketErr || !ticket || ticket.tenant_id !== tenantId) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_type: 'tenant',
      sender_id: tenantId,
      message,
    });
    if (error) throw error;

    return res.status(201).json({ message: 'Message added' });
  } catch (err) {
    console.error('POST /tenant/tickets/:ticketId/messages error:', err);
    return res.status(500).json({ message: 'Failed to add message' });
  }
});

// Announcements for tenant
tenantRouter.get('/announcements', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { data: tenancies, error: tErr } = await supabase
      .from('tenancies')
      .select('id, unit_id, landlord_id')
      .eq('tenant_id', tenantId);
    if (tErr) throw tErr;
    if (!tenancies?.length) return res.json({ announcements: [] });

    const tenancyIds = tenancies.map((t) => t.id);
    const unitIds = tenancies.map((t) => t.unit_id).filter(Boolean);

    let propertyIds = [];
    if (unitIds.length) {
      const { data: units, error: unitsErr } = await supabase
        .from('units')
        .select('id, property_id')
        .in('id', unitIds);
      if (unitsErr) throw unitsErr;
      propertyIds = units?.map((u) => u.property_id).filter(Boolean) || [];
    }

    let query = supabase
      .from('announcements')
      .select('id, title, message, target_type, property_id, unit_id, tenant_id, visible_from, visible_to, created_at, landlord_id')
      .or(
        [
          `tenant_id.eq.${tenantId}`,
          unitIds.length ? `unit_id.in.(${unitIds.join(',')})` : null,
          propertyIds.length ? `property_id.in.(${propertyIds.join(',')})` : null,
          `tenant_id.is.null`,
        ]
          .filter(Boolean)
          .join(',')
      )
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ announcements: data || [] });
  } catch (err) {
    console.error('GET /tenant/announcements error:', err);
    return res.status(500).json({ message: 'Failed to load announcements' });
  }
});

// Documents for tenant
tenantRouter.get('/documents', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { data: tenancies, error: tErr } = await supabase
      .from('tenancies')
      .select('id')
      .eq('tenant_id', tenantId);
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
    console.error('GET /tenant/documents error:', err);
    return res.status(500).json({ message: 'Failed to load documents' });
  }
});

/**
 * POST /tenant/vacate-requests
 * Body: { tenantId, tenancyId, requestedMoveOutDate, reason }
 */
tenantRouter.post('/vacate-requests', async (req, res) => {
  try {
    const { tenancyId, requestedMoveOutDate, reason } = req.body || {};
    const tenantId = req.tenantId;

    if (!tenantId || !tenancyId || !requestedMoveOutDate) {
      return res
        .status(400)
        .json({ message: 'tenancyId and requestedMoveOutDate are required' });
    }

    const { data: tenancy, error: tenancyError } = await supabase
      .from('tenancies')
      .select('id, tenant_id')
      .eq('id', tenancyId)
      .maybeSingle();

    if (tenancyError || !tenancy || tenancy.tenant_id !== tenantId) {
      return res.status(404).json({ message: 'Tenancy not found for this tenant' });
    }

    const { data: existing, error: existingError } = await supabase
      .from('vacate_requests')
      .select('id, status')
      .eq('tenancy_id', tenancyId)
      .in('status', ['pending', 'approved']);

    if (existingError) throw existingError;
    if (existing && existing.length > 0) {
      return res.status(400).json({ message: 'There is already an active vacate request' });
    }

    const { data: vrInsert, error: vrError } = await supabase
      .from('vacate_requests')
      .insert({
        tenancy_id: tenancyId,
        tenant_id: tenantId,
        requested_move_out_date: requestedMoveOutDate,
        status: 'pending',
        reason: reason || '',
      })
      .select('id')
      .single();

    if (vrError) {
      console.error('Error creating vacate request:', vrError);
      return res.status(500).json({ message: 'Failed to create vacate request' });
    }

    return res.status(201).json({
      message: 'Vacate request submitted',
      vacateRequestId: vrInsert.id,
    });
  } catch (err) {
    console.error('POST /tenant/vacate-requests error:', err);
    return res.status(500).json({ message: 'Failed to submit vacate request' });
  }
});
