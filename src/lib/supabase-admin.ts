import { createClient } from '@supabase/supabase-js';

let supabaseAdminInstance: any = null;

export function getSupabaseAdmin(): any {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for server-side admin client');
  }

  // This client bypasses RLS. Use ONLY on the server side.
  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey);
  return supabaseAdminInstance;
}
