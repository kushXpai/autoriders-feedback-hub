// api/create-member.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type AppRole = 'superadmin' | 'admin' | 'manager' | 'user' | 'vendor_admin';

const ALLOWED_ROLES: AppRole[] = ['superadmin', 'admin', 'manager', 'user', 'vendor_admin'];

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
    // ── Verify requesting user is an admin or superadmin ──────────────────────
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
    if (!['admin', 'superadmin'].includes(roleData.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // ── Validate body ─────────────────────────────────────────────────────────
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }

    // Only superadmin can create another superadmin
    if (role === 'superadmin' && roleData.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only a superadmin can create another superadmin' });
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
      .insert({ user_id: userId, role });

    if (roleInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to assign role: ${roleInsertError.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Member created successfully',
      member: { user_id: userId, name, email, role },
    });

  } catch (error: any) {
    console.error('Member creation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create member' });
  }
}