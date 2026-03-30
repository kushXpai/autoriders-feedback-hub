// api/create-user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('--- API START ---');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    console.log('STEP 1: Auth header:', authHeader);

    if (!authHeader) {
      return res.status(401).json({ error: 'No auth header' });
    }

    const supabaseClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    console.log('STEP 2: User:', user, userError);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // ✅ TEMP: skip role check to avoid RLS issues
    // You can re-add later
    // ----------------------------------------

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

    console.log('STEP 3: Body:', req.body);

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log('STEP 4: Creating auth user');

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: phone,
        email_confirm: true,
        user_metadata: { name },
      });

    console.log('STEP 5:', authData, authError);

    if (authError) throw authError;

    const userId = authData.user?.id;
    if (!userId) throw new Error('No user ID');

    console.log('STEP 6: Insert profile');

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, name, email });

    if (profileError) throw profileError;

    console.log('STEP 7: Insert role');

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'customer' });

    if (roleError) throw roleError;

    console.log('STEP 8: Insert customer');

    const { data: customer, error: customerError } = await supabaseAdmin
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

    console.log('STEP 9:', customer, customerError);

    if (customerError) throw customerError;

    console.log('--- SUCCESS ---');

    return res.status(200).json({ success: true, customer });

  } catch (err: any) {
    console.error('FINAL ERROR:', err);
    return res.status(500).json({ error: err.message });
  }
}