// api/delete-user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

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
    const ALLOWED_ROLES = ['superadmin', 'admin', 'manager'];
    if (!ALLOWED_ROLES.includes(roleData.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    // ── Validate userId ───────────────────────────────────────────────────────
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (typeof userId !== 'string') return res.status(400).json({ error: 'userId must be a string' });
    if (!isValidUUID(userId)) return res.status(400).json({ error: `Invalid UUID: "${userId}"` });
    if (userId === user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

    // ── Admin client ──────────────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Step 1: Nullify user_id in customers (keep customer record) ───────────
    const { error: customerError } = await supabaseAdmin
      .from('customers')
      .update({ user_id: null })
      .eq('user_id', userId);

    if (customerError) throw new Error(`Failed to unlink customer: ${customerError.message}`);

    // ── Step 2: Delete from user_roles ────────────────────────────────────────
    const { error: roleDeleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (roleDeleteError) throw new Error(`Failed to delete role: ${roleDeleteError.message}`);

    // ── Step 3: Delete from profiles ──────────────────────────────────────────
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) throw new Error(`Failed to delete profile: ${profileDeleteError.message}`);

    // ── Step 4: Delete from auth.users ────────────────────────────────────────
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw new Error(`Failed to delete auth user: ${authError.message}`);

    return res.status(200).json({ success: true, message: 'Customer user deleted successfully' });

  } catch (error: any) {
    console.error('[delete-user] error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
}