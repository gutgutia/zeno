import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, dashboardId } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    if (!dashboardId || typeof dashboardId !== 'string') {
      return NextResponse.json({ error: 'Dashboard ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Hash the token to look up the session
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find the session
    const { data: session, error } = await supabase
      .from('external_viewer_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('dashboard_id', dashboardId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    // Update last accessed time
    await supabase
      .from('external_viewer_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', session.id);

    return NextResponse.json({
      valid: true,
      email: session.email,
      expires_at: session.expires_at,
    });
  } catch (error) {
    console.error('Error verifying external session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
