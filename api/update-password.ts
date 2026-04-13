// api/update-password.ts
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
    const ALLOWED_ROLES = ['superadmin', 'admin', 'manager'];
    if (!ALLOWED_ROLES.includes(roleData.role)) return res.status(403).json({ error: 'Insufficient permissions' });

    // ── Validate body ─────────────────────────────────────────────────────────
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) return res.status(400).json({ error: 'Missing userId or newPassword' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // ── Admin client ──────────────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Password updated successfully' });

  } catch (error: any) {
    console.error('Password update error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update password' });
  }
}