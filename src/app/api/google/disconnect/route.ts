import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revokeGoogleAccess, deleteGoogleConnection } from '@/lib/google/auth';

export async function POST() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workspaceData, error: workspaceError } = await (supabase as any)
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .eq('type', 'personal')
      .single();

    if (workspaceError || !workspaceData) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const workspaceId = workspaceData.id as string;

    // Get Google connection for this workspace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connectionData, error: connectionError } = await (supabase as any)
      .from('google_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connection = connectionData as any;

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Google connection found' },
        { status: 404 }
      );
    }

    // Revoke access at Google (best effort - don't fail if this fails)
    try {
      await revokeGoogleAccess(connection.access_token);
    } catch (error) {
      console.error('Failed to revoke at Google (continuing anyway):', error);
    }

    // Delete the connection from our database
    await deleteGoogleConnection(connection.id);

    return NextResponse.json({
      success: true,
      message: 'Google account disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Google account:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google account' },
      { status: 500 }
    );
  }
}

