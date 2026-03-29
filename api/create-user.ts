// api/create-user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // ── Verify requesting user is an admin ────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const supabaseClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData) return res.status(403).json({ error: 'Unable to verify role' });
    if (roleData.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    // ── Validate request body ─────────────────────────────────────────────────
    const { name, email, phone, employee_id, expat_type, allocated_car, start_date, end_date, is_active } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Missing required fields: name, email, phone' });
    }

    // Password is the phone number
    const password = phone;
    if (password.length < 6) {
      return res.status(400).json({ error: 'Phone number must be at least 6 characters to use as password' });
    }

    // ── Admin client ──────────────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Step 1: Create auth.users entry ──────────────────────────────────────
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError) throw authError;

    const userId = authData.user?.id;
    if (!userId) throw new Error('Failed to get user ID from Supabase Auth');

    // ── Step 2: Insert into profiles ──────────────────────────────────────────
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, name, email });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    // ── Step 3: Insert into user_roles ────────────────────────────────────────
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'customer' });

    if (roleInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to assign role: ${roleInsertError.message}`);
    }

    // ── Step 4: Insert into customers ─────────────────────────────────────────
    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({
        name,
        email,
        phone: phone || null,
        employee_id,
        expat_type: expat_type ?? 'existing',
        allocated_car: allocated_car || null,
        start_date: start_date || null,
        end_date: end_date || null,
        is_active: is_active ?? true,
        user_id: userId,
      })
      .select()
      .single();

    if (customerError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create customer record: ${customerError.message}`);
    }

    return res.status(200).json({
      success: true,
      customer: customerData,
      message: 'Customer created successfully',
    });

  } catch (error: any) {
    console.error('Customer creation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create customer' });
  }
}