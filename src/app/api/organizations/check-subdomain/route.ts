import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Reserved subdomains that cannot be used
const RESERVED_SUBDOMAINS = [
  'www', 'app', 'api', 'admin', 'dashboard', 'dashboards',
  'auth', 'login', 'signup', 'register', 'account', 'accounts',
  'settings', 'config', 'help', 'support', 'docs', 'documentation',
  'blog', 'news', 'status', 'mail', 'email', 'ftp', 'cdn',
  'static', 'assets', 'images', 'img', 'media', 'files',
  'dev', 'staging', 'test', 'demo', 'sandbox', 'beta',
  'internal', 'private', 'public', 'enterprise', 'pro',
  'zeno', 'team', 'org', 'organization', 'workspace',
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get('subdomain');

    if (!subdomain) {
      return NextResponse.json({ error: 'Subdomain is required' }, { status: 400 });
    }

    // Validate format
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
      return NextResponse.json({
        available: false,
        reason: 'Invalid subdomain format',
      });
    }

    if (subdomain.length < 3) {
      return NextResponse.json({
        available: false,
        reason: 'Subdomain must be at least 3 characters',
      });
    }

    if (subdomain.length > 63) {
      return NextResponse.json({
        available: false,
        reason: 'Subdomain must be 63 characters or less',
      });
    }

    // Check reserved subdomains
    if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
      return NextResponse.json({
        available: false,
        reason: 'This subdomain is reserved',
      });
    }

    const supabase = await createClient();

    // Check if subdomain is already taken by an organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingOrg } = await (supabase as any)
      .from('organizations')
      .select('id')
      .eq('subdomain', subdomain)
      .single();

    if (existingOrg) {
      return NextResponse.json({
        available: false,
        reason: 'Subdomain is already taken',
      });
    }

    // Also check reserved_subdomains table if it exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: reserved } = await (supabase as any)
      .from('reserved_subdomains')
      .select('subdomain')
      .eq('subdomain', subdomain)
      .single();

    if (reserved) {
      return NextResponse.json({
        available: false,
        reason: 'This subdomain is reserved',
      });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error('Subdomain check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
