import { supabase } from './supabaseClient.js';

/**
 * Reads Authorization: Bearer <token>, validates via Supabase,
 * and attaches req.authUser and req.roles (landlord/tenant/caretaker/admin).
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Missing Authorization token' });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Auth error:', error);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.authUser = user;
    const userId = user.id;

    const [{ data: landlord }, { data: tenant }, { data: caretaker }, { data: admin }] =
      await Promise.all([
        supabase.from('landlords').select('id').eq('auth_user_id', userId).maybeSingle(),
        supabase.from('tenants').select('id').eq('auth_user_id', userId).maybeSingle(),
        supabase.from('caretakers').select('id').eq('auth_user_id', userId).maybeSingle(),
        supabase.from('system_admins').select('id, is_super').eq('auth_user_id', userId).maybeSingle(),
      ]);

    req.roles = {
      landlordId: landlord?.id || null,
      tenantId: tenant?.id || null,
      caretakerId: caretaker?.id || null,
      adminId: admin?.id || null,
      isSuperAdmin: admin?.is_super || false,
    };

    next();
  } catch (err) {
    console.error('requireAuth middleware error:', err);
    return res.status(500).json({ message: 'Auth middleware failed' });
  }
}

export function requireLandlord(req, res, next) {
  if (!req.roles?.landlordId) {
    return res.status(403).json({ message: 'Landlord access required' });
  }
  req.landlordId = req.roles.landlordId;
  next();
}

export function requireTenant(req, res, next) {
  if (!req.roles?.tenantId) {
    return res.status(403).json({ message: 'Tenant access required' });
  }
  req.tenantId = req.roles.tenantId;
  next();
}

export function requireCaretaker(req, res, next) {
  if (!req.roles?.caretakerId) {
    return res.status(403).json({ message: 'Caretaker access required' });
  }
  req.caretakerId = req.roles.caretakerId;
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.roles?.adminId) {
    return res.status(403).json({ message: 'System admin access required' });
  }
  req.adminId = req.roles.adminId;
  req.isSuperAdmin = req.roles.isSuperAdmin;
  next();
}
