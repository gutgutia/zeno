import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

// Reserved subdomains that cannot be claimed
const RESERVED_SUBDOMAINS = [
  'www', 'app', 'api', 'admin',
  'dashboard', 'dashboards',
  'login', 'signup', 'settings',
  'help', 'support', 'docs', 'blog',
  'mail', 'email', 'ftp', 'cdn', 'assets', 'static'
];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subdomain = request.nextUrl.searchParams.get('subdomain');

  if (!subdomain) {
    return NextResponse.json({ error: 'Subdomain parameter required' }, { status: 400 });
  }

  // Validate format
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
    return NextResponse.json({
      available: false,
      reason: 'Invalid subdomain format'
    });
  }

  // Check if reserved
  if (RESERVED_SUBDOMAINS.includes(subdomain)) {
    return NextResponse.json({
      available: false,
      reason: 'This subdomain is reserved'
    });
  }

  // Also check database reserved_subdomains table
  const { data: reservedData } = await adminSupabase
    .from('reserved_subdomains')
    .select('subdomain')
    .eq('subdomain', subdomain)
    .single();

  if (reservedData) {
    return NextResponse.json({
      available: false,
      reason: 'This subdomain is reserved'
    });
  }

  // Check if already taken
  const { data: existingWorkspace } = await adminSupabase
    .from('workspaces')
    .select('id, owner_id')
    .eq('subdomain', subdomain)
    .single();

  if (existingWorkspace) {
    // Check if it belongs to the current user (they can keep their own subdomain)
    if (existingWorkspace.owner_id === user.id) {
      return NextResponse.json({ available: true });
    }

    return NextResponse.json({
      available: false,
      reason: 'This subdomain is already taken'
    });
  }

  return NextResponse.json({ available: true });
}
