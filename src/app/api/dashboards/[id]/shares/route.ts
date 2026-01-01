import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { DashboardShare } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/dashboards/[id]/shares - List shares for a dashboard
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership via workspace
    const { data: dashboard } = await supabase
      .from('dashboards')
      .select('workspace_id, workspaces!inner(owner_id)')
      .eq('id', id)
      .single();

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboardData = dashboard as { workspace_id: string; workspaces: { owner_id: string } };
    if (dashboardData.workspaces.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get shares
    const { data: shares, error } = await supabase
      .from('dashboard_shares')
      .select('*')
      .eq('dashboard_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shares: shares as DashboardShare[] });
  } catch (error) {
    console.error('Error fetching shares:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/dashboards/[id]/shares - Add a share
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { share_type, share_value } = body;

    // Validate input
    if (!share_type || !['domain', 'email'].includes(share_type)) {
      return NextResponse.json({ error: 'Invalid share_type' }, { status: 400 });
    }

    if (!share_value || typeof share_value !== 'string') {
      return NextResponse.json({ error: 'share_value is required' }, { status: 400 });
    }

    // Validate format
    const normalizedValue = share_value.toLowerCase().trim();

    if (share_type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedValue)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    } else if (share_type === 'domain') {
      // Basic domain validation - should have at least one dot
      const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
      if (!domainRegex.test(normalizedValue)) {
        return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
      }
    }

    // Verify ownership via workspace
    const { data: dashboard } = await supabase
      .from('dashboards')
      .select('workspace_id, workspaces!inner(owner_id)')
      .eq('id', id)
      .single();

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboardData = dashboard as { workspace_id: string; workspaces: { owner_id: string } };
    if (dashboardData.workspaces.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create share
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: share, error } = await (supabase as any)
      .from('dashboard_shares')
      .insert({
        dashboard_id: id,
        share_type,
        share_value: normalizedValue,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'This share already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ share: share as DashboardShare }, { status: 201 });
  } catch (error) {
    console.error('Error creating share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
