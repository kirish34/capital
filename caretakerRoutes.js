import express from 'express';
import { supabase } from './supabaseClient.js';
import { requireCaretaker } from './authMiddleware.js';

export const caretakerRouter = express.Router();
caretakerRouter.use(requireCaretaker);

// GET /caretaker/overview?caretakerId=
caretakerRouter.get('/overview', async (req, res) => {
  try {
    const caretakerId = req.caretakerId;

    const { data: caretaker, error: caretakerError } = await supabase
      .from('caretakers')
      .select('id, full_name, phone, email')
      .eq('id', caretakerId)
      .maybeSingle();

    if (caretakerError || !caretaker) {
      return res.status(404).json({ message: 'Caretaker not found' });
    }

    const { data: caretakerProps, error: cpError } = await supabase
      .from('caretaker_properties')
      .select('property_id')
      .eq('caretaker_id', caretakerId);

    if (cpError) throw cpError;

    const propertyIds = caretakerProps.map((cp) => cp.property_id);
    if (!propertyIds.length) {
      return res.json({
        caretaker,
        properties: [],
        summary: {
          totalUnits: 0,
          occupiedUnits: 0,
          openTicketsCount: 0,
        },
        recentWaterLogs: [],
        openTickets: [],
      });
    }

    const { data: properties, error: propsError } = await supabase
      .from('properties')
      .select('id, name, location')
      .in('id', propertyIds);
    if (propsError) throw propsError;

    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, property_id, unit_code, status')
      .in('property_id', propertyIds);
    if (unitsError) throw unitsError;

    const unitIds = units.map((u) => u.id);

    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, title, status, priority, created_at, property_id, unit_id')
      .in('property_id', propertyIds)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (ticketsError) throw ticketsError;

    const { data: waterLogs, error: waterError } = await supabase
      .from('water_meter_logs')
      .select('id, unit_id, property_id, reading_date, units_used, amount, billing_period, created_at')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false })
      .limit(20);
    if (waterError) throw waterError;

    const unitsById = new Map(units.map((u) => [u.id, u]));
    const propsById = new Map(properties.map((p) => [p.id, p]));

    const totalUnits = units.length;
    const occupiedUnits = units.filter((u) => u.status === 'occupied').length;
    const openTicketsCount = tickets.length;

    const propertiesStats = properties.map((p) => {
      const propUnits = units.filter((u) => u.property_id === p.id);
      const propTotal = propUnits.length;
      const propOccupied = propUnits.filter((u) => u.status === 'occupied').length;
      const propVacant = propUnits.filter((u) => u.status === 'vacant').length;
      return {
        id: p.id,
        name: p.name,
        location: p.location,
        totalUnits: propTotal,
        occupiedUnits: propOccupied,
        vacantUnits: propVacant,
      };
    });

    const openTickets = tickets.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      createdAt: t.created_at,
      propertyName: t.property_id ? propsById.get(t.property_id)?.name || null : null,
      unitCode: t.unit_id ? unitsById.get(t.unit_id)?.unit_code || null : null,
    }));

    const recentWaterLogs = waterLogs.map((log) => ({
      id: log.id,
      readingDate: log.reading_date,
      unitsUsed: Number(log.units_used),
      amount: Number(log.amount),
      billingPeriod: log.billing_period,
      propertyName: log.property_id ? propsById.get(log.property_id)?.name || null : null,
      unitCode: log.unit_id ? unitsById.get(log.unit_id)?.unit_code || null : null,
    }));

    return res.json({
      caretaker,
      properties: propertiesStats,
      summary: {
        totalUnits,
        occupiedUnits,
        openTicketsCount,
      },
      openTickets,
      recentWaterLogs,
    });
  } catch (err) {
    console.error('GET /caretaker/overview error:', err);
    return res.status(500).json({ message: 'Failed to load caretaker overview' });
  }
});

// GET /caretaker/properties?caretakerId=
caretakerRouter.get('/properties', async (req, res) => {
  try {
    const caretakerId = req.caretakerId;

    const { data: caretakerProps, error: cpError } = await supabase
      .from('caretaker_properties')
      .select('property_id')
      .eq('caretaker_id', caretakerId);
    if (cpError) throw cpError;

    const propertyIds = caretakerProps.map((cp) => cp.property_id);
    if (!propertyIds.length) {
      return res.json({ properties: [], units: [] });
    }

    const { data: properties, error: propsError } = await supabase
      .from('properties')
      .select('id, name, location')
      .in('id', propertyIds);
    if (propsError) throw propsError;

    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, property_id, unit_code, type, status, base_rent')
      .in('property_id', propertyIds);
    if (unitsError) throw unitsError;

    return res.json({ properties, units });
  } catch (err) {
    console.error('GET /caretaker/properties error:', err);
    return res.status(500).json({ message: 'Failed to load caretaker properties' });
  }
});

// -------- Tenant Leads (capture) --------
caretakerRouter.get('/tenant-leads', async (req, res) => {
  try {
    const caretakerId = req.caretakerId;
    const { data: leads, error } = await supabase
      .from('tenant_leads')
      .select('id, property_id, unit_id, full_name, phone, email, notes, status, created_at')
      .eq('caretaker_id', caretakerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ leads: leads || [] });
  } catch (err) {
    console.error('GET /caretaker/tenant-leads error:', err);
    return res.status(500).json({ message: 'Failed to load tenant leads' });
  }
});

caretakerRouter.post('/tenant-leads', async (req, res) => {
  try {
    const caretakerId = req.caretakerId;
    const { fullName, phone, email, notes, propertyId, unitId } = req.body || {};
    if (!fullName || !phone || !propertyId) {
      return res.status(400).json({ message: 'fullName, phone and propertyId are required' });
    }

    // ensure property assigned to caretaker
    const { data: cp, error: cpError } = await supabase
      .from('caretaker_properties')
      .select('property_id')
      .eq('caretaker_id', caretakerId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (cpError || !cp) {
      return res.status(403).json({ message: 'Not allowed for this property' });
    }

    // ensure landlord and unit info
    const { data: propertyRow, error: propErr } = await supabase
      .from('properties')
      .select('id, landlord_id')
      .eq('id', propertyId)
      .maybeSingle();
    if (propErr || !propertyRow) return res.status(400).json({ message: 'Property not found' });

    if (unitId) {
      const { data: unit, error: unitErr } = await supabase
        .from('units')
        .select('id, status')
        .eq('id', unitId)
        .eq('property_id', propertyId)
        .maybeSingle();
      if (unitErr || !unit) return res.status(400).json({ message: 'Unit not found' });
      if (unit.status !== 'vacant') return res.status(400).json({ message: 'Unit is not vacant' });
    }

    const { error: insertErr } = await supabase.from('tenant_leads').insert({
      caretaker_id: caretakerId,
      landlord_id: propertyRow.landlord_id,
      property_id: propertyId,
      unit_id: unitId || null,
      full_name: fullName,
      phone,
      email: email || null,
      notes: notes || '',
      status: 'pending',
    });
    if (insertErr) throw insertErr;
    return res.status(201).json({ message: 'Lead captured' });
  } catch (err) {
    console.error('POST /caretaker/tenant-leads error:', err);
    return res.status(500).json({ message: 'Failed to save tenant lead' });
  }
});

// POST /caretaker/water-logs
caretakerRouter.post('/water-logs', async (req, res) => {
  try {
    const { propertyId, unitId, readingDate, readingValue, pricePerUnit } = req.body || {};
    const caretakerId = req.caretakerId;

    if (!caretakerId || !propertyId || !unitId || !readingDate || readingValue == null) {
      return res.status(400).json({
        message: 'propertyId, unitId, readingDate, readingValue are required',
      });
    }

    const { data: cp, error: cpError } = await supabase
      .from('caretaker_properties')
      .select('id')
      .eq('caretaker_id', caretakerId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (cpError || !cp) {
      return res.status(403).json({ message: 'Caretaker not assigned to this property' });
    }

    const { data: lastLog, error: lastError } = await supabase
      .from('water_meter_logs')
      .select('reading_value, reading_date')
      .eq('unit_id', unitId)
      .order('reading_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) {
      console.error('Error fetching last water log:', lastError);
    }

    const prevValue = lastLog ? Number(lastLog.reading_value) : 0;
    const unitsUsed = Number(readingValue) - prevValue;
    const safeUnitsUsed = unitsUsed < 0 ? 0 : unitsUsed;
    const ppu = pricePerUnit != null ? Number(pricePerUnit) : 0;
    const amount = safeUnitsUsed * ppu;

    const periodDate = new Date(readingDate);
    const year = periodDate.getFullYear();
    const month = String(periodDate.getMonth() + 1).padStart(2, '0');
    const billingPeriod = `${year}-${month}`;

    const { data: insertLog, error: insertError } = await supabase
      .from('water_meter_logs')
      .insert({
        property_id: propertyId,
        unit_id: unitId,
        caretaker_id: caretakerId,
        reading_date: readingDate,
        reading_value: Number(readingValue),
        previous_reading_value: prevValue,
        units_used: safeUnitsUsed,
        price_per_unit: ppu,
        amount,
        billing_period: billingPeriod,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting water log:', insertError);
      return res.status(500).json({ message: 'Failed to save water reading' });
    }

    return res.status(201).json({
      message: 'Water reading recorded',
      logId: insertLog.id,
      unitsUsed: safeUnitsUsed,
      amount,
      billingPeriod,
    });
  } catch (err) {
    console.error('POST /caretaker/water-logs error:', err);
    return res.status(500).json({ message: 'Failed to save water reading' });
  }
});

// GET /caretaker/tickets?caretakerId=
caretakerRouter.get('/tickets', async (req, res) => {
  try {
    const caretakerId = req.caretakerId;

    const { data: caretakerProps, error: cpError } = await supabase
      .from('caretaker_properties')
      .select('property_id')
      .eq('caretaker_id', caretakerId);
    if (cpError) throw cpError;

    const propertyIds = caretakerProps.map((cp) => cp.property_id);
    if (!propertyIds.length) {
      return res.json({ tickets: [] });
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, title, status, priority, created_at, property_id, unit_id, tenant_id')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false });
    if (ticketsError) throw ticketsError;

    const propIds = [...new Set(tickets.map((t) => t.property_id).filter(Boolean))];
    const unitIds = [...new Set(tickets.map((t) => t.unit_id).filter(Boolean))];
    const tenantIds = [...new Set(tickets.map((t) => t.tenant_id).filter(Boolean))];

    const { data: properties, error: propsError } = await supabase
      .from('properties')
      .select('id, name')
      .in('id', propIds);
    if (propsError) throw propsError;

    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, unit_code')
      .in('id', unitIds);
    if (unitsError) throw unitsError;

    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, full_name')
      .in('id', tenantIds);
    if (tenantsError) throw tenantsError;

    const propsById = new Map(properties.map((p) => [p.id, p]));
    const unitsById = new Map(units.map((u) => [u.id, u]));
    const tenantsById = new Map(tenants.map((t) => [t.id, t]));

    const formatted = tickets.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      createdAt: t.created_at,
      propertyName: t.property_id ? propsById.get(t.property_id)?.name || null : null,
      unitCode: t.unit_id ? unitsById.get(t.unit_id)?.unit_code || null : null,
      tenantName: t.tenant_id ? tenantsById.get(t.tenant_id)?.full_name || null : null,
    }));

    return res.json({ tickets: formatted });
  } catch (err) {
    console.error('GET /caretaker/tickets error:', err);
    return res.status(500).json({ message: 'Failed to load caretaker tickets' });
  }
});

// POST /caretaker/tickets/:ticketId/status
caretakerRouter.post('/tickets/:ticketId/status', async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);
    const { status } = req.body || {};
    const caretakerId = req.caretakerId;

    if (!caretakerId || !ticketId || !status) {
      return res.status(400).json({ message: 'ticketId and status are required' });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, property_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketError || !ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const { data: cp, error: cpError } = await supabase
      .from('caretaker_properties')
      .select('id')
      .eq('caretaker_id', caretakerId)
      .eq('property_id', ticket.property_id)
      .maybeSingle();
    if (cpError || !cp) {
      return res.status(403).json({ message: 'Not allowed to modify this ticket' });
    }

    const updated = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'resolved' || status === 'closed') {
      updated.resolved_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase.from('tickets').update(updated).eq('id', ticketId);
    if (updateError) {
      console.error('Error updating ticket status:', updateError);
      return res.status(500).json({ message: 'Failed to update ticket status' });
    }

    return res.json({ message: 'Ticket status updated' });
  } catch (err) {
    console.error('POST /caretaker/tickets/:ticketId/status error:', err);
    return res.status(500).json({ message: 'Failed to update ticket status' });
  }
});

// GET /caretaker/tickets/:ticketId/messages
caretakerRouter.get('/tickets/:ticketId/messages', async (req, res) => {
  try {
    const ticketId = Number(req.params.ticketId);
    if (!ticketId) return res.status(400).json({ message: 'ticketId required' });

    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, property_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketErr || !ticket) return res.status(404).json({ message: 'Ticket not found' });

    const { data: messages, error } = await supabase
      .from('ticket_messages')
      .select('id, sender_type, sender_id, message, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return res.json({ messages: messages || [] });
  } catch (err) {
    console.error('GET /caretaker/tickets/:ticketId/messages error:', err);
    return res.status(500).json({ message: 'Failed to load messages' });
  }
});

// POST /caretaker/tickets/:ticketId/messages
caretakerRouter.post('/tickets/:ticketId/messages', async (req, res) => {
  try {
    const caretakerId = req.caretakerId;
    const ticketId = Number(req.params.ticketId);
    const { message } = req.body || {};
    if (!caretakerId || !ticketId || !message) {
      return res.status(400).json({ message: 'ticketId and message are required' });
    }

    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('id, property_id')
      .eq('id', ticketId)
      .maybeSingle();
    if (ticketErr || !ticket) return res.status(404).json({ message: 'Ticket not found' });

    const { data: cp, error: cpError } = await supabase
      .from('caretaker_properties')
      .select('id')
      .eq('caretaker_id', caretakerId)
      .eq('property_id', ticket.property_id)
      .maybeSingle();
    if (cpError || !cp) return res.status(403).json({ message: 'Not allowed to message on this ticket' });

    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_type: 'caretaker',
      sender_id: caretakerId,
      message,
    });
    if (error) throw error;

    return res.status(201).json({ message: 'Message added' });
  } catch (err) {
    console.error('POST /caretaker/tickets/:ticketId/messages error:', err);
    return res.status(500).json({ message: 'Failed to add message' });
  }
});
