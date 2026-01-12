import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { mpesaRouter } from './mpesaRoutes.js';
import { landlordRouter } from './landlordRoutes.js';
import { tenantRouter } from './tenantRoutes.js';
import { caretakerRouter } from './caretakerRoutes.js';
import { adminRouter } from './adminRoutes.js';
import { requireAuth } from './authMiddleware.js';
import { supabase } from './supabaseClient.js';
import { publicRouter } from './publicRoutes.js';

dotenv.config();

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const isAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin);
  res.header('Access-Control-Allow-Origin', isAllowed ? origin || '*' : 'null');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Callback-Token, X-Forwarded-For');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  if (!isAllowed) {
    return res.status(403).send('Origin not allowed');
  }
  next();
});

// Safaricom normally posts form-urlencoded or JSON depending on setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Rent System Backend is running 😎');
});

app.use('/mpesa', mpesaRouter);
app.use('/admin', requireAuth, adminRouter);
app.use('/landlord', requireAuth, landlordRouter);
app.use('/tenant', requireAuth, tenantRouter);
app.use('/caretaker', requireAuth, caretakerRouter);
app.use('/public', publicRouter);

// One-time/system admin bootstrap with secret token
app.post('/bootstrap/system-admin', async (req, res) => {
  try {
    const token = req.headers['x-bootstrap-token'] || req.query.token;
    const expected = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expected || token !== expected) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { email, password, fullName, phone, isSuper = true } = req.body || {};
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: 'email, password, fullName are required' });
    }

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (userError || !userData?.user?.id) {
      console.error('Bootstrap admin createUser error', userError);
      return res.status(500).json({ message: 'Failed to create auth user' });
    }

    const authUserId = userData.user.id;

    const { data: adminRow, error: insertError } = await supabase
      .from('system_admins')
      .insert({
        auth_user_id: authUserId,
        full_name: fullName,
        email,
        phone: phone || null,
        is_super: !!isSuper,
      })
      .select('id, full_name, email, phone, is_super, auth_user_id')
      .single();

    if (insertError) {
      console.error('Bootstrap admin insert error', insertError);
      return res.status(500).json({ message: 'Failed to save system admin' });
    }

    return res.status(201).json({ message: 'System admin created', admin: adminRow });
  } catch (err) {
    console.error('Bootstrap system admin error', err);
    return res.status(500).json({ message: 'Internal error' });
  }
});

const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export { app };
