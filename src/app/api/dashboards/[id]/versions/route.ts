import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Dashboard, DashboardVersion } from '@/types/database';
import { getVersions, restoreVersion } from '@/lib/versions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/dashboards/[id]/versions
 * List all versions of a dashboard
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify dashboard ownership
    const { data: dashboardData, error: fetchError } = await supabase
      .from('dashboards')
      .select('*, workspaces!inner(owner_id)')
      .eq('id', id)
      .single();

    if (fetchError || !dashboardData) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboard = dashboardData as Dashboard & {
      workspaces: { owner_id: string }
    };

    if (dashboard.workspaces.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all versions
    const versions = await getVersions(supabase, id);

    return NextResponse.json({
      versions,
      currentVersion: {
        major: dashboard.current_major_version,
        minor: dashboard.current_minor_version,
        label: `${dashboard.current_major_version}.${dashboard.current_minor_version}`,
      },
    });
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch versions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboards/[id]/versions
 * Restore to a specific version
 *
 * Body:
 * - major: number
 * - minor: number
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { major, minor } = body;

    if (typeof major !== 'number' || typeof minor !== 'number') {
      return NextResponse.json(
        { error: 'major and minor version numbers are required' },
        { status: 400 }
      );
    }

    // Verify dashboard ownership
    const { data: dashboardData, error: fetchError } = await supabase
      .from('dashboards')
      .select('*, workspaces!inner(owner_id)')
      .eq('id', id)
      .single();

    if (fetchError || !dashboardData) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboard = dashboardData as Dashboard & {
      workspaces: { owner_id: string }
    };

    if (dashboard.workspaces.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Restore to the specified version
    const result = await restoreVersion(supabase, id, major, minor, user.id);

    return NextResponse.json({
      success: true,
      message: `Restored to version ${major}.${minor}`,
      dashboard: result.dashboard,
      newVersion: {
        major: result.version.major_version,
        minor: result.version.minor_version,
        label: `${result.version.major_version}.${result.version.minor_version}`,
      },
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore version' },
      { status: 500 }
    );
  }
}
