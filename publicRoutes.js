import express from 'express';
import { supabase } from './supabaseClient.js';

export const publicRouter = express.Router();

// GET /public/listings
publicRouter.get('/listings', async (req, res) => {
  try {
    const propertyId = req.query.propertyId ? Number(req.query.propertyId) : null;
    let query = supabase
      .from('public_listings')
      .select('id, unit_id, property_id, title, description, rent_amount, photos, is_active, listed_at, removed_at')
      .eq('is_active', true);
    if (propertyId) query = query.eq('property_id', propertyId);

    const { data: listings, error } = await query.order('listed_at', { ascending: false });
    if (error) throw error;
    if (!listings?.length) return res.json({ listings: [] });

    const propertyIds = [...new Set(listings.map((l) => l.property_id).filter(Boolean))];
    const unitIds = [...new Set(listings.map((l) => l.unit_id).filter(Boolean))];

    const [properties, units] = await Promise.all([
      propertyIds.length
        ? supabase.from('properties').select('id, name, location').in('id', propertyIds)
        : { data: [] },
      unitIds.length
        ? supabase.from('units').select('id, unit_code, type, base_rent').in('id', unitIds)
        : { data: [] },
    ]);

    const propsById = new Map((properties.data || []).map((p) => [p.id, p]));
    const unitsById = new Map((units.data || []).map((u) => [u.id, u]));

    const formatted = listings.map((l) => ({
      ...l,
      property: l.property_id ? propsById.get(l.property_id) || null : null,
      unit: l.unit_id ? unitsById.get(l.unit_id) || null : null,
    }));

    return res.json({ listings: formatted });
  } catch (err) {
    console.error('GET /public/listings error:', err);
    return res.status(500).json({ message: 'Failed to load listings' });
  }
});

// POST /public/applications
publicRouter.post('/applications', async (req, res) => {
  try {
    const { listingId, fullName, phone, email, employmentInfo, monthlyIncome, notes } = req.body || {};
    if (!listingId || !fullName || !phone) {
      return res.status(400).json({ message: 'listingId, fullName and phone are required' });
    }

    const { data: listing, error: listingErr } = await supabase
      .from('public_listings')
      .select('id, property_id, unit_id, is_active')
      .eq('id', listingId)
      .maybeSingle();
    if (listingErr || !listing || !listing.is_active) {
      return res.status(404).json({ message: 'Listing not found or inactive' });
    }

    const { data: app, error: appErr } = await supabase
      .from('applications')
      .insert({
        property_id: listing.property_id,
        unit_id: listing.unit_id,
        status: 'pending',
        full_name: fullName,
        phone,
        email: email || null,
        employment_info: employmentInfo || null,
        monthly_income: monthlyIncome || null,
        notes: notes || null,
      })
      .select('id')
      .single();
    if (appErr) throw appErr;

    return res.status(201).json({ message: 'Application submitted', applicationId: app.id });
  } catch (err) {
    console.error('POST /public/applications error:', err);
    return res.status(500).json({ message: 'Failed to submit application' });
  }
});
