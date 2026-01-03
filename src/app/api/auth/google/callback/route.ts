import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  saveGoogleConnection,
} from '@/lib/google/auth';

// Force dynamic to ensure cookies are read fresh
export const dynamic = 'force-dynamic';

// GET /api/auth/google/callback - Handle Google OAuth callback
export async function GET(request: NextRequest) {
  // Determine base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('Google OAuth error:', error);
      return redirectWithError(baseUrl, 'Google authorization was denied or failed');
    }

    if (!code || !state) {
      return redirectWithError(baseUrl, 'Invalid OAuth callback - missing code or state');
    }

    // Decode and validate state
    let stateData: { userId: string; workspaceId: string; timestamp: number; returnUrl?: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return redirectWithError(baseUrl, 'Invalid OAuth state');
    }

    // Check state timestamp (expire after 10 minutes)
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      return redirectWithError(baseUrl, 'OAuth session expired. Please try again.', stateData.returnUrl);
    }

    // Verify the user is still authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Log auth state for debugging
    if (authError) {
      console.error('Google OAuth callback - auth error:', authError);
    }
    if (!user) {
      console.error('Google OAuth callback - no user session found');
    } else if (user.id !== stateData.userId) {
      console.error('Google OAuth callback - user ID mismatch:', {
        sessionUserId: user.id,
        stateUserId: stateData.userId
      });
    }

    if (authError || !user || user.id !== stateData.userId) {
      // Redirect to auth page with a redirect back to connections after login
      const authUrl = new URL('/auth', baseUrl);
      authUrl.searchParams.set('google_error', 'Your session expired. Please log in and try connecting Google again.');
      authUrl.searchParams.set('redirect', stateData.returnUrl || '/settings/connections');
      return NextResponse.redirect(authUrl);
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return redirectWithError(baseUrl, 'Failed to obtain Google tokens. Please try again.', stateData.returnUrl);
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

    // Redirect back to the page they came from
    const returnPath = stateData.returnUrl || '/settings/connections';
    const redirectUrl = new URL(returnPath, baseUrl);
    redirectUrl.searchParams.set('google_connected', 'true');
    redirectUrl.searchParams.set('google_email', googleUser.email);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return redirectWithError(baseUrl, 'Failed to complete Google authorization');
  }
}

function redirectWithError(baseUrl: string, message: string, returnUrl?: string): NextResponse {
  const redirectPath = returnUrl || '/settings/connections';
  const redirectUrl = new URL(redirectPath, baseUrl);
  redirectUrl.searchParams.set('google_error', message);
  return NextResponse.redirect(redirectUrl);
}
