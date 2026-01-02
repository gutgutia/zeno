import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  saveGoogleConnection,
} from '@/lib/google/auth';

// GET /api/auth/google/callback - Handle Google OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('Google OAuth error:', error);
      return redirectWithError('Google authorization was denied or failed');
    }

    if (!code || !state) {
      return redirectWithError('Invalid OAuth callback - missing code or state');
    }

    // Decode and validate state
    let stateData: { userId: string; workspaceId: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return redirectWithError('Invalid OAuth state');
    }

    // Check state timestamp (expire after 10 minutes)
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      return redirectWithError('OAuth session expired. Please try again.');
    }

    // Verify the user is still authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== stateData.userId) {
      return redirectWithError('Authentication mismatch. Please log in and try again.');
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return redirectWithError('Failed to obtain Google tokens. Please try again.');
    }

    // Get Google user info
    const googleUser = await getGoogleUserInfo(tokens.access_token);

    // Save the connection
    await saveGoogleConnection(
      stateData.userId,
      stateData.workspaceId,
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      },
      googleUser
    );

    // Redirect back to dashboard creation with success
    const redirectUrl = new URL('/dashboards/new', process.env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set('google_connected', 'true');
    redirectUrl.searchParams.set('google_email', googleUser.email);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return redirectWithError('Failed to complete Google authorization');
  }
}

function redirectWithError(message: string): NextResponse {
  const redirectUrl = new URL('/dashboards/new', process.env.NEXT_PUBLIC_APP_URL);
  redirectUrl.searchParams.set('google_error', message);
  return NextResponse.redirect(redirectUrl);
}
