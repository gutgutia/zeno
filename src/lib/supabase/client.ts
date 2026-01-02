import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Use placeholder values for build time (actual values needed at runtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
