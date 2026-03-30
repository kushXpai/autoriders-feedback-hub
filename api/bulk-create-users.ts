// api/bulk-create-users.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface UserRow {
  name: string;
  email: string;
  phone: string;
  password: string;
  expat_type: 'new' | 'existing';
  allocated_car?: string;
  car_registration_number?: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
}

interface RowResult {
  row: number;
  email: string;
  success: boolean;
  error?: string;
}

// ✅ FIX: remove strict typing here (match working file pattern)
async function createOneUser(
  supabaseAdmin: any,
  user: UserRow,
  employeeId: string
): Promise<void> {
  const password = user.password?.trim() || user.phone?.trim();

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  // Step 1: auth.users
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    user_metadata: { name: user.name },
  });

  if (authError) throw authError;

  const userId = authData.user?.id;
  if (!userId) throw new Error('Failed to get user ID from Supabase Auth');

  // Step 2: profiles
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      name: user.name,
      email: user.email,
    });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(`Failed to create profile: ${profileError.message}`);
  }

  // Step 3: user_roles
  const { error: roleError } = await supabaseAdmin
    .from('user_roles')
    .insert({
      user_id: userId,
      role: 'customer',
    });

  if (roleError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(`Failed to assign role: ${roleError.message}`);
  }

  // Step 4: customers
  const { error: customerError } = await supabaseAdmin
    .from('customers')
    .insert({
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      employee_id: employeeId,
      expat_type: user.expat_type ?? 'existing',
      allocated_car: user.allocated_car || null,
      car_registration_number: user.car_registration_number || null,
      start_date: user.start_date || null,
      end_date: user.end_date || null,
      is_active: user.is_active ?? true,
      user_id: userId,
    });

  if (customerError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(`Failed to create customer record: ${customerError.message}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ── Verify admin ──────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const supabaseClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !roleData) {
      return res.status(403).json({ error: 'Unable to verify role' });
    }

    if (roleData.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // ── Validate payload ──────────────────────────────────────
    const { users }: { users: UserRow[] } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'No users provided' });
    }

    if (users.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 users per upload' });
    }

    // ── Admin client ──────────────────────────────────────────
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // ── Get last employee ID ──────────────────────────────────
    const { data: lastRaw } = await supabaseAdmin
      .from('customers')
      .select('employee_id')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastNum =
      parseInt(((lastRaw as any)?.employee_id ?? 'EMP-0000').replace('EMP-', ''), 10) || 0;

    // ── Batch processing ──────────────────────────────────────
    const BATCH_SIZE = 5;
    const results: RowResult[] = [];

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (u, batchIdx): Promise<RowResult> => {
          const rowNum = i + batchIdx + 1;

          if (!u.name?.trim()) return { row: rowNum, email: u.email ?? '', success: false, error: 'Missing name' };
          if (!u.email?.trim()) return { row: rowNum, email: u.email ?? '', success: false, error: 'Missing email' };
          if (!u.phone?.trim()) return { row: rowNum, email: u.email, success: false, error: 'Missing phone' };

          const employeeId = `EMP-${String(lastNum + i + batchIdx + 1).padStart(4, '0')}`;

          try {
            await createOneUser(supabaseAdmin, u, employeeId);
            return { row: rowNum, email: u.email, success: true };
          } catch (err: any) {
            return {
              row: rowNum,
              email: u.email,
              success: false,
              error: err.message || 'Unknown error',
            };
          }
        })
      );

      results.push(...batchResults);
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);

    return res.status(200).json({
      success: true,
      total: users.length,
      succeeded,
      failed: failed.length,
      errors: failed,
      message: `${succeeded} of ${users.length} customers created successfully.`,
    });

  } catch (error: any) {
    console.error('[bulk-create-users] error:', error);
    return res.status(500).json({
      error: error.message || 'Bulk create failed',
    });
  }
}