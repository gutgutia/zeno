import { google } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

// OAuth configuration
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Create OAuth2 client
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );
}

// Generate authorization URL
export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent', // Force consent to always get refresh token
  });
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Get user info from Google
export async function getGoogleUserInfo(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  return {
    email: data.email!,
    id: data.id!,
    name: data.name,
    picture: data.picture,
  };
}

// Refresh an expired access token
export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  return {
    accessToken: credentials.access_token!,
    expiresAt: credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000), // Default 1 hour
  };
}

// Get a valid access token for a connection (refreshes if needed)
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const supabase = await createClient();

  // Get the connection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: connection, error } = await (supabase as any)
    .from('google_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (error || !connection) {
    throw new Error('Google connection not found');
  }

  // Check if token is still valid (with 5 minute buffer)
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    // Token is still valid
    return connection.access_token;
  }

  // Token expired or expiring soon, refresh it
  try {
    const { accessToken, expiresAt: newExpiresAt } = await refreshAccessToken(
      connection.refresh_token
    );

    // Update the connection with new token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('google_connections')
      .update({
        access_token: accessToken,
        token_expires_at: newExpiresAt.toISOString(),
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('Failed to update token:', updateError);
    }

    return accessToken;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    throw new Error('Failed to refresh Google access token. Please reconnect your Google account.');
  }
}

// Save a new Google connection
export async function saveGoogleConnection(
  userId: string,
  workspaceId: string,
  tokens: {
    access_token: string;
    refresh_token: string;
    expiry_date?: number | null;
  },
  userInfo: { email: string; id: string }
) {
  const supabase = await createClient();

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000);

  // Upsert - update if same workspace+email exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('google_connections')
    .upsert(
      {
        user_id: userId,
        workspace_id: workspaceId,
        google_email: userInfo.email,
        google_user_id: userInfo.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
      },
      {
        onConflict: 'workspace_id,google_email',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save Google connection: ${error.message}`);
  }

  return data;
}

// Get Google connection for a workspace
export async function getWorkspaceGoogleConnection(workspaceId: string) {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('google_connections')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found
    throw new Error(`Failed to get Google connection: ${error.message}`);
  }

  return data;
}

// Delete a Google connection
export async function deleteGoogleConnection(connectionId: string) {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('google_connections')
    .delete()
    .eq('id', connectionId);

  if (error) {
    throw new Error(`Failed to delete Google connection: ${error.message}`);
  }
}

// Revoke Google access (optional - call Google's revoke endpoint)
export async function revokeGoogleAccess(accessToken: string) {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (error) {
    // Revocation failure is not critical
    console.error('Failed to revoke Google access:', error);
  }
}
