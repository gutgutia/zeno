import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/google/connection/status - Check if user has Google connected
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get workspace_id from query params
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspace_id is required' },
        { status: 400 }
      );
    }

    // Check for Google connection for this workspace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection } = await (supabase as any)
      .from('google_connections')
      .select('id, google_email')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Always return 200 with connection status
    return NextResponse.json({
      connected: !!connection,
      email: connection?.google_email || null,
    });
  } catch (error) {
    console.error('Error checking Google connection:', error);
    return NextResponse.json(
      { error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}
