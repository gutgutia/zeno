import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Dashboard, BrandingConfig } from '@/types/database';
import { getMergedBranding } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/dashboards/[id] - Get a single dashboard
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the dashboard with organization branding and domain info
    const { data, error } = await supabase
      .from('dashboards')
      .select('*, organizations!inner(id, created_by, branding, subdomain, custom_domain)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboardData = data as Dashboard & {
      organizations: {
        id: string;
        created_by: string;
        branding: BrandingConfig | null;
        subdomain: string | null;
        custom_domain: string | null;
      };
    };

    // Check ownership - user must be organization owner or member
    const isOwner = dashboardData.organizations.created_by === user.id;

    if (!isOwner) {
      // Check if user is a member of the organization
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', dashboardData.organizations.id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Merge organization branding with dashboard override
    const effectiveBranding = getMergedBranding(
      dashboardData.organizations.branding,
      dashboardData.branding_override
    );

    // Extract organization info for share URLs
    const organization = {
      subdomain: dashboardData.organizations.subdomain,
      custom_domain: dashboardData.organizations.custom_domain,
    };

    // Remove nested organization from response, add merged branding and org info
    const { organizations: _, ...dashboard } = dashboardData;

    return NextResponse.json({
      dashboard,
      branding: effectiveBranding,
      organization,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/dashboards/[id] - Update a dashboard
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, config, data, dataSource, is_published } = body;

    // Get the existing dashboard
    const { data: existingData, error: fetchError } = await supabase
      .from('dashboards')
      .select('*, organizations!inner(id, created_by)')
      .eq('id', id)
      .single();

    if (fetchError || !existingData) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    // Type assertion for joined data
    const existingDashboard = existingData as Dashboard & {
      organizations: { id: string; created_by: string };
    };

    // Check ownership - user must be organization owner or member
    const isOwner = existingDashboard.organizations.created_by === user.id;

    if (!isOwner) {
      // Check if user is a member of the organization
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', existingDashboard.organizations.id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (config !== undefined) updates.config = config;
    if (data !== undefined) updates.data = data;
    if (dataSource !== undefined) updates.data_source = dataSource;
    if (is_published !== undefined) {
      updates.is_published = is_published;
      if (is_published && !existingDashboard.is_published) {
        updates.published_at = new Date().toISOString();
      }
    }

    // Update the dashboard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedData, error: updateError } = await (supabase as any)
      .from('dashboards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ dashboard: updatedData as Dashboard });
  } catch (error) {
    console.error('Error updating dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/dashboards/[id] - Soft delete a dashboard (move to trash)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the dashboard (need to check both deleted and non-deleted)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingData, error: fetchError } = await (supabase as any)
      .from('dashboards')
      .select('*, organizations!inner(id, created_by)')
      .eq('id', id)
      .single();

    if (fetchError || !existingData) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    // Type assertion for joined data
    const existingDashboard = existingData as Dashboard & {
      organizations: { id: string; created_by: string };
    };

    // Check ownership - user must be organization owner or member
    const isOwner = existingDashboard.organizations.created_by === user.id;

    if (!isOwner) {
      // Check if user is a member of the organization
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership } = await (supabase as any)
        .from('organization_members')
        .select('role')
        .eq('organization_id', existingDashboard.organizations.id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Check if already deleted
    if (existingDashboard.deleted_at) {
      return NextResponse.json({ error: 'Dashboard is already in trash' }, { status: 400 });
    }

    // Soft delete: set deleted_at timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('dashboards')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Dashboard moved to trash' });
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
