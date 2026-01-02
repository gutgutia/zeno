import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Workspace } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/workspaces/[id] - Get a workspace
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json({ workspace: data as Workspace });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Reserved subdomains that cannot be claimed
const RESERVED_SUBDOMAINS = [
  'www', 'app', 'api', 'admin',
  'dashboard', 'dashboards',
  'login', 'signup', 'settings',
  'help', 'support', 'docs', 'blog',
  'mail', 'email', 'ftp', 'cdn', 'assets', 'static'
];

// PUT /api/workspaces/[id] - Update a workspace (including branding and subdomain)
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, branding, subdomain } = body;

    // Check ownership
    const { data: existing, error: fetchError } = await supabase
      .from('workspaces')
      .select('id, subdomain')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const currentSubdomain = (existing as { subdomain: string | null }).subdomain;

    // Validate subdomain if provided
    if (subdomain !== undefined && subdomain !== null && subdomain !== '') {
      // Check format
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
        return NextResponse.json({ error: 'Invalid subdomain format' }, { status: 400 });
      }

      // Check if reserved
      if (RESERVED_SUBDOMAINS.includes(subdomain)) {
        return NextResponse.json({ error: 'This subdomain is reserved' }, { status: 400 });
      }

      // Check if already taken (if different from current)
      if (subdomain !== currentSubdomain) {
        const { data: takenWorkspace } = await supabase
          .from('workspaces')
          .select('id')
          .eq('subdomain', subdomain)
          .single();

        if (takenWorkspace) {
          return NextResponse.json({ error: 'This subdomain is already taken' }, { status: 400 });
        }
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (branding !== undefined) updates.branding = branding;
    if (subdomain !== undefined) updates.subdomain = subdomain || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workspace: data as Workspace });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
