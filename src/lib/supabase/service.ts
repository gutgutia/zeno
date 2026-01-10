import { createClient } from '@supabase/supabase-js';

// Service client that takes URL and key as parameters
// This bypasses RLS for server-side operations
export function createServiceClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
