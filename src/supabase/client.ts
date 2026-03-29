// src/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Supabase] Missing env vars. Check your .env file.');
}

// ============================================================
// LOCAL DEVELOPMENT (no proxy)
// Use this when testing on localhost.
// Comment this out before deploying to Vercel.
// ============================================================
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// PRODUCTION (with proxy)
// Uncomment this and comment out the one above before deploying.
// Requires /supabase proxy route configured in vite.config.ts
// or your Vercel rewrites.
// ============================================================
// export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
//   global: {
//     fetch: (url: RequestInfo | URL, options?: RequestInit) => {
//       const proxied = url.toString().replace(
//         SUPABASE_URL,
//         window.location.origin + '/supabase'
//       );
//       return fetch(proxied, options);
//     },
//   },
// });