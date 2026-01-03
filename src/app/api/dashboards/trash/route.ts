import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Dashboard, Workspace } from '@/types/database';

// GET /api/dashboards/trash - List all deleted dashboards for the current user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's personal workspace
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .eq('type', 'personal')
      .single();

    if (workspaceError || !workspaceData) {
      return NextResponse.json({ dashboards: [] });
    }

    const workspace = workspaceData as unknown as Workspace;

    // Get deleted dashboards (deleted_at IS NOT NULL)
    // The RLS policy "Users can view their deleted dashboards" handles this
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('dashboards')
      .select('*')
      .eq('workspace_id', workspace.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dashboards: data as Dashboard[] });
  } catch (error) {
    console.error('Error fetching deleted dashboards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
