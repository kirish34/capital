import express from 'express';
import { supabase } from './supabaseClient.js';
import { requireAdmin } from './authMiddleware.js';

export const adminRouter = express.Router();

adminRouter.use(requireAdmin);

// POST /admin/system-admins (super admins only)
adminRouter.post('/system-admins', async (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ message: 'Super admin access required' });
    }
    const { email, password, fullName, phone, isSuper = false, authUserId } = req.body || {};
    if (!email || !fullName) {
      return res.status(400).json({ message: 'email and fullName are required' });
    }

    let userId = authUserId || null;
    if (!userId) {
      if (!password) {
        return res.status(400).json({ message: 'password required when creating a new auth user' });
      }
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (userError || !userData?.user?.id) {
        console.error('create system admin user error', userError);
        return res.status(500).json({ message: 'Failed to create auth user' });
      }
      userId = userData.user.id;
    }

    const { data: adminRow, error: insertError } = await supabase
      .from('system_admins')
      .insert({
        auth_user_id: userId,
        full_name: fullName,
        email,
        phone: phone || null,
        is_super: !!isSuper,
      })
      .select('id, full_name, email, phone, is_super, auth_user_id')
      .single();

    if (insertError) {
      console.error('create system admin insert error', insertError);
      return res.status(500).json({ message: 'Failed to save system admin' });
    }

    return res.status(201).json({ message: 'System admin created', admin: adminRow });
  } catch (err) {
    console.error('POST /admin/system-admins error:', err);
    return res.status(500).json({ message: 'Failed to create system admin' });
  }
});

// POST /admin/landlords
adminRouter.post('/landlords', async (req, res) => {
  try {
    const {
      landlordType = 'individual',
      fullName,
      phone,
      email,
      companyName,
      companyContactName,
      companyContactPhone,
      idNumber,
      kraPin,
      contractUrl,
      contractNotes,
      authUserId,
    } = req.body || {};

    const isCompany = landlordType === 'company';
    const nameValue = isCompany ? companyName || fullName : fullName;
    const phoneValue = isCompany ? companyContactPhone || phone : phone;

    if (!email || !nameValue || !phoneValue) {
      return res
        .status(400)
        .json({ message: 'Missing required fields: name/phone/email (for company, use company + contact fields).' });
    }

    if (isCompany) {
      if (!companyName || !companyContactName || !companyContactPhone) {
        return res.status(400).json({ message: 'Company requires companyName, companyContactName, companyContactPhone.' });
      }
    }

    const { data, error } = await supabase
      .from('landlords')
      .insert({
        name: nameValue,
        phone: phoneValue,
        email,
        landlord_type: landlordType || 'individual',
        company_name: companyName || null,
        company_contact_name: companyContactName || null,
        company_contact_phone: companyContactPhone || null,
        id_number: idNumber || null,
        kra_pin: kraPin || null,
        contract_url: contractUrl || null,
        contract_notes: contractNotes || null,
        auth_user_id: authUserId || null,
      })
      .select(
        'id, name, phone, email, landlord_type, company_name, company_contact_name, company_contact_phone, id_number, kra_pin, contract_url, contract_notes, auth_user_id'
      )
      .single();

    if (error) {
      console.error('Error creating landlord:', error);
      return res.status(500).json({ message: 'Failed to create landlord' });
    }

    return res.status(201).json({
      message: 'Landlord registered',
      landlord: data,
    });
  } catch (err) {
    console.error('POST /admin/landlords error:', err);
    return res.status(500).json({ message: 'Failed to create landlord' });
  }
});

// GET /admin/landlords
adminRouter.get('/landlords', async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim();

    let query = supabase
      .from('landlords')
      .select(
        'id, name, phone, email, landlord_type, paybill_id, auth_user_id, company_name, company_contact_name, company_contact_phone, id_number, kra_pin, contract_url, contract_notes'
      );

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: landlords, error } = await query.order('id', { ascending: true });

    if (error) {
      console.error('Error listing landlords:', error);
      return res.status(500).json({ message: 'Failed to list landlords' });
    }

    const paybillIds = [...new Set(landlords.map((l) => l.paybill_id).filter(Boolean))];

    let paybillsById = new Map();
    if (paybillIds.length) {
      const { data: paybills, error: paybillsError } = await supabase
        .from('paybills')
        .select('id, shortcode, name, account_type, is_active')
        .in('id', paybillIds);

      if (paybillsError) {
        console.error('Error loading paybills for landlords:', paybillsError);
      } else {
        paybillsById = new Map(paybills.map((p) => [p.id, p]));
      }
    }

    const result = landlords.map((l) => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      email: l.email,
      authUserId: l.auth_user_id || null,
      landlordType: l.landlord_type || 'individual',
      companyName: l.company_name || null,
      companyContactName: l.company_contact_name || null,
      companyContactPhone: l.company_contact_phone || null,
      idNumber: l.id_number || null,
      kraPin: l.kra_pin || null,
      contractUrl: l.contract_url || null,
      contractNotes: l.contract_notes || null,
      paybill: l.paybill_id ? paybillsById.get(l.paybill_id) || null : null,
    }));

    return res.json({ landlords: result });
  } catch (err) {
    console.error('GET /admin/landlords error:', err);
    return res.status(500).json({ message: 'Failed to list landlords' });
  }
});

// POST /admin/properties
adminRouter.post('/properties', async (req, res) => {
  try {
    const { landlordId, name, location, description, unitCount, unitPrefix } = req.body || {};
    if (!landlordId || !name) {
      return res.status(400).json({ message: 'landlordId and name are required' });
    }

    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('id, name')
      .eq('id', Number(landlordId))
      .maybeSingle();
    if (landlordError || !landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    const { data: prop, error } = await supabase
      .from('properties')
      .insert({
        landlord_id: Number(landlordId),
        name,
        location: location || null,
        description: description || null,
        map_url: req.body?.mapUrl || null,
      })
      .select('id, landlord_id, name, location, description, status, created_at, map_url')
      .single();

    if (error) {
      console.error('Error creating property:', error);
      return res.status(500).json({ message: 'Failed to create property' });
    }

    // Optional: bulk create units with prefix and count
    const count = Number(unitCount) || 0;
    const prefix = (unitPrefix || 'R').toString().trim();
    if (count > 0) {
      const unitsPayload = [];
      for (let i = 1; i <= count; i++) {
        const code = `${prefix}${i}`;
        unitsPayload.push({
          property_id: prop.id,
          unit_code: code,
          type: 'room',
          status: 'vacant',
          base_rent: 0,
          waste_fee: 0,
        });
      }
      const { error: unitsError } = await supabase.from('units').insert(unitsPayload);
      if (unitsError) {
        console.error('Error creating units for property:', unitsError);
        // Do not fail property creation; return warning
        return res.status(201).json({
          message: 'Property created, but failed to create units',
          property: prop,
          warning: 'Units not created',
        });
      }
    }

    return res.status(201).json({ message: 'Property created', property: prop });
  } catch (err) {
    console.error('POST /admin/properties error:', err);
    return res.status(500).json({ message: 'Failed to create property' });
  }
});

// GET /admin/properties
adminRouter.get('/properties', async (req, res) => {
  try {
    const landlordId = req.query.landlordId ? Number(req.query.landlordId) : null;
    let query = supabase
      .from('properties')
      .select('id, landlord_id, name, location, description, status, created_at, map_url')
      .order('created_at', { ascending: false });
    if (landlordId) {
      query = query.eq('landlord_id', landlordId);
    }

    const { data: props, error } = await query;
    if (error) {
      console.error('Error listing properties:', error);
      return res.status(500).json({ message: 'Failed to list properties' });
    }

    const landlordIds = [...new Set((props || []).map((p) => p.landlord_id).filter(Boolean))];
    const propertyIds = [...new Set((props || []).map((p) => p.id))];
    let landlordsById = new Map();
    if (landlordIds.length) {
      const { data: landlords, error: lErr } = await supabase
        .from('landlords')
        .select('id, name')
        .in('id', landlordIds);
      if (!lErr && landlords) {
        landlordsById = new Map(landlords.map((l) => [l.id, l]));
      }
    }

    // fetch units to compute counts and preview codes
    let unitsByProperty = new Map();
    if (propertyIds.length) {
      const { data: units, error: uErr } = await supabase
        .from('units')
        .select('id, property_id, unit_code, status')
        .in('property_id', propertyIds);
      if (uErr) {
        console.error('Error listing units for properties:', uErr);
      } else {
        for (const u of units || []) {
          if (!unitsByProperty.has(u.property_id)) unitsByProperty.set(u.property_id, []);
          unitsByProperty.get(u.property_id).push(u);
        }
      }
    }

    const formatted = (props || []).map((p) => {
      const units = unitsByProperty.get(p.id) || [];
      return {
        id: p.id,
        landlordId: p.landlord_id,
        landlordName: landlordsById.get(p.landlord_id)?.name || null,
        name: p.name,
        location: p.location,
        description: p.description,
        status: p.status,
        createdAt: p.created_at,
        unitsCount: units.length,
        unitsPreview: units.slice(0, 5).map((u) => u.unit_code),
        mapUrl: p.map_url || null,
      };
    });

    return res.json({ properties: formatted });
  } catch (err) {
    console.error('GET /admin/properties error:', err);
    return res.status(500).json({ message: 'Failed to list properties' });
  }
});

// POST /admin/paybills
adminRouter.post('/paybills', async (req, res) => {
  try {
    const { shortcode, name, accountType, ownerLandlordId } = req.body || {};

    if (!shortcode || !name) {
      return res.status(400).json({ message: 'shortcode and name are required' });
    }

    const payload = {
      shortcode,
      name,
      account_type: accountType || 'wallet_per_tenancy',
      owner_landlord_id: ownerLandlordId || null,
      created_by_admin: req.adminId,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('paybills')
      .insert(payload)
      .select('id, shortcode, name, account_type, is_active, owner_landlord_id')
      .single();

    if (error) {
      console.error('Error creating paybill:', error);
      return res.status(500).json({ message: 'Failed to create paybill' });
    }

    return res.status(201).json({
      message: 'Paybill registered',
      paybill: data,
    });
  } catch (err) {
    console.error('POST /admin/paybills error:', err);
    return res.status(500).json({ message: 'Failed to create paybill' });
  }
});

// GET /admin/paybills
adminRouter.get('/paybills', async (req, res) => {
  try {
    const active = req.query.active;
    let query = supabase
      .from('paybills')
      .select('id, shortcode, name, account_type, is_active, owner_landlord_id, created_at')
      .order('created_at', { ascending: false });

    if (active === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing paybills:', error);
      return res.status(500).json({ message: 'Failed to list paybills' });
    }

    return res.json({ paybills: data });
  } catch (err) {
    console.error('GET /admin/paybills error:', err);
    return res.status(500).json({ message: 'Failed to list paybills' });
  }
});

// POST /admin/landlords/:landlordId/paybill
adminRouter.post('/landlords/:landlordId/paybill', async (req, res) => {
  try {
    const landlordId = Number(req.params.landlordId);
    const { paybillId } = req.body || {};

    if (!landlordId || !paybillId) {
      return res.status(400).json({ message: 'landlordId and paybillId are required' });
    }

    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('id')
      .eq('id', landlordId)
      .maybeSingle();
    if (landlordError || !landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    const { data: paybill, error: paybillError } = await supabase
      .from('paybills')
      .select('id, shortcode, is_active')
      .eq('id', paybillId)
      .maybeSingle();
    if (paybillError || !paybill) {
      return res.status(404).json({ message: 'Paybill not found' });
    }

    if (!paybill.is_active) {
      return res.status(400).json({ message: 'Paybill is inactive' });
    }

    const { error: updateError } = await supabase.from('landlords').update({ paybill_id: paybillId }).eq('id', landlordId);
    if (updateError) {
      console.error('Error assigning paybill:', updateError);
      return res.status(500).json({ message: 'Failed to assign paybill' });
    }

    return res.json({ message: 'Paybill assigned to landlord' });
  } catch (err) {
    console.error('POST /admin/landlords/:landlordId/paybill error:', err);
    return res.status(500).json({ message: 'Failed to assign paybill' });
  }
});

/**
 * POST /admin/landlords/:landlordId/auth
 * Body: { email, password }
 * Creates a Supabase auth user and links it to the landlord (auth_user_id).
 */
adminRouter.post('/landlords/:landlordId/auth', async (req, res) => {
  try {
    const landlordId = Number(req.params.landlordId);
    const { email, password } = req.body || {};

    if (!landlordId || !email || !password) {
      return res.status(400).json({ message: 'landlordId, email and password are required' });
    }

    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('id, auth_user_id, name')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError || !landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    if (landlord.auth_user_id) {
      return res.status(400).json({ message: 'Landlord already linked to an auth user' });
    }

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (userError) {
      console.error('Error creating auth user:', userError);
      return res.status(500).json({ message: userError.message || 'Failed to create auth user' });
    }

    const authUserId = userData?.user?.id;

    const { error: updateError } = await supabase
      .from('landlords')
      .update({ auth_user_id: authUserId })
      .eq('id', landlordId);

    if (updateError) {
      console.error('Error linking auth_user_id to landlord:', updateError);
      return res.status(500).json({ message: 'Auth user created, but failed to link to landlord' });
    }

    return res.status(201).json({
      message: 'Landlord auth user created and linked',
      authUserId,
      email,
    });
  } catch (err) {
    console.error('POST /admin/landlords/:landlordId/auth error:', err);
    return res.status(500).json({ message: 'Failed to create landlord login' });
  }
});

// PATCH /admin/landlords/:landlordId
adminRouter.patch('/landlords/:landlordId', async (req, res) => {
  try {
    const landlordId = Number(req.params.landlordId);
    const {
      name,
      phone,
      email,
      landlordType,
      companyName,
      companyContactName,
      companyContactPhone,
      idNumber,
      kraPin,
      contractUrl,
      contractNotes,
    } = req.body || {};

    if (!landlordId) {
      return res.status(400).json({ message: 'landlordId is required' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (email) updates.email = email;
    if (landlordType) updates.landlord_type = landlordType;
    if (companyName !== undefined) updates.company_name = companyName || null;
    if (companyContactName !== undefined) updates.company_contact_name = companyContactName || null;
    if (companyContactPhone !== undefined) updates.company_contact_phone = companyContactPhone || null;
    if (idNumber !== undefined) updates.id_number = idNumber || null;
    if (kraPin !== undefined) updates.kra_pin = kraPin || null;
    if (contractUrl !== undefined) updates.contract_url = contractUrl || null;
    if (contractNotes !== undefined) updates.contract_notes = contractNotes || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const { data, error } = await supabase
      .from('landlords')
      .update(updates)
      .eq('id', landlordId)
      .select(
        'id, name, phone, email, landlord_type, paybill_id, auth_user_id, company_name, company_contact_name, company_contact_phone, id_number, kra_pin, contract_url, contract_notes'
      )
      .maybeSingle();

    if (error) {
      console.error('Error updating landlord:', error);
      return res.status(500).json({ message: 'Failed to update landlord' });
    }

    return res.json({ message: 'Landlord updated', landlord: data });
  } catch (err) {
    console.error('PATCH /admin/landlords/:landlordId error:', err);
    return res.status(500).json({ message: 'Failed to update landlord' });
  }
});

// DELETE /admin/landlords/:landlordId
adminRouter.delete('/landlords/:landlordId', async (req, res) => {
  try {
    const landlordId = Number(req.params.landlordId);
    if (!landlordId) {
      return res.status(400).json({ message: 'landlordId is required' });
    }

    const { error } = await supabase.from('landlords').delete().eq('id', landlordId);
    if (error) {
      console.error('Error deleting landlord:', error);
      return res.status(500).json({ message: 'Failed to delete landlord' });
    }

    return res.json({ message: 'Landlord deleted' });
  } catch (err) {
    console.error('DELETE /admin/landlords/:landlordId error:', err);
    return res.status(500).json({ message: 'Failed to delete landlord' });
  }
});

// POST /admin/tenants
adminRouter.post('/tenants', async (req, res) => {
  try {
    const { fullName, phone, email, idNumber } = req.body || {};
    if (!fullName || !phone) {
      return res.status(400).json({ message: 'fullName and phone are required' });
    }
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        full_name: fullName,
        phone,
        email: email || null,
        id_number: idNumber || null,
      })
      .select('id, full_name, phone, email, id_number, status, created_at')
      .single();
    if (error) {
      console.error('Error creating tenant:', error);
      return res.status(500).json({ message: 'Failed to create tenant' });
    }
    return res.status(201).json({ message: 'Tenant created', tenant: data });
  } catch (err) {
    console.error('POST /admin/tenants error:', err);
    return res.status(500).json({ message: 'Failed to create tenant' });
  }
});

// GET /admin/tenants
adminRouter.get('/tenants', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, full_name, phone, email, id_number, status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      console.error('Error listing tenants:', error);
      return res.status(500).json({ message: 'Failed to list tenants' });
    }
    return res.json({ tenants: data || [] });
  } catch (err) {
    console.error('GET /admin/tenants error:', err);
    return res.status(500).json({ message: 'Failed to list tenants' });
  }
});
