// api/create-user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('--- API HIT: /api/create-user ---');

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('STEP 0: ENV CHECK');
    console.log('SUPABASE_URL:', !!process.env.SUPABASE_URL);
    console.log('SERVICE_ROLE:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // ── AUTH HEADER ─────────────────────────────
    const authHeader = req.headers.authorization;
    console.log('STEP 1: Auth header:', authHeader);

    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const supabaseClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // ── GET USER ───────────────────────────────
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    console.log('STEP 2: User fetch result:', user, userError);

    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ── ROLE CHECK ─────────────────────────────
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    console.log('STEP 3: Role data:', roleData, roleError);

    if (roleError || !roleData) {
      return res.status(403).json({ error: 'Role check failed' });
    }

    if (roleData.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // ── BODY ───────────────────────────────────
    const {
      name,
      email,
      phone,
      employee_id,
      expat_type,
      allocated_car,
      car_registration_number,
      start_date,
      end_date,
      is_active
    } = req.body;

    console.log('STEP 4: Body:', req.body);

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const password = phone;
    if (password.length < 6) {
      return res.status(400).json({ error: 'Phone must be >= 6 chars' });
    }

    // ── ADMIN CLIENT ───────────────────────────
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log('STEP 5: Creating auth user');

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    console.log('STEP 6: Auth result:', authData, authError);

    if (authError) throw authError;

    const userId = authData.user?.id;
    if (!userId) throw new Error('No user ID returned');

    // ── PROFILE ────────────────────────────────
    console.log('STEP 7: Creating profile');

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, name, email });

    console.log('STEP 8: Profile result:', profileError);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    // ── ROLE INSERT ────────────────────────────
    console.log('STEP 9: Inserting role');

    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'customer' });

    console.log('STEP 10: Role insert result:', roleInsertError);

    if (roleInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw roleInsertError;
    }

    // ── CUSTOMER ───────────────────────────────
    console.log('STEP 11: Creating customer');

    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({
        name,
        email,
        phone,
        employee_id,
        expat_type,
        allocated_car,
        car_registration_number,
        start_date,
        end_date,
        is_active,
        user_id: userId,
      })
      .select()
      .single();

    console.log('STEP 12: Customer result:', customerData, customerError);

    if (customerError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw customerError;
    }

    console.log('SUCCESS');

    return res.status(200).json({
      success: true,
      customer: customerData,
    });

  } catch (error: any) {
    console.error('FINAL ERROR:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create customer'
    });
  }
}