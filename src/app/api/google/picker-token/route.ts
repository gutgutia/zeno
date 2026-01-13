import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google/auth';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = request.nextUrl.searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
  }

  try {
    // Get the Google connection for this workspace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection, error } = await (supabase as any)
      .from('google_connections')
      .select('id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !connection) {
      return NextResponse.json({ error: 'No Google connection found' }, { status: 404 });
    }

    // Get a valid access token (refreshes if needed)
    const accessToken = await getValidAccessToken(connection.id);

    return NextResponse.json({
      accessToken,
      // Client ID needed for Google Picker
      clientId: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    console.error('Error getting picker token:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get access token' },
      { status: 500 }
    );
  }
}
