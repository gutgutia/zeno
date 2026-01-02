import { createClient } from '@supabase/supabase-js';

// Admin client with service role key - use only on server side
// This bypasses RLS for admin operations like OTP management
export function createAdminClient() {
  // Use placeholder values for build time (actual values needed at runtime)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
