import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWelcomeEmail, sendNewUserNotificationEmail } from '@/lib/email/send';
import type { DashboardShare } from '@/types/database';
import { createHash, randomBytes } from 'crypto';

const MAX_ATTEMPTS = 5;
const EXTERNAL_SESSION_EXPIRY_HOURS = 24;

// Generate a secure session token for external viewers
function generateSessionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

// Ensure profile and workspace exist for internal users
async function ensureUserSetup(supabase: ReturnType<typeof createAdminClient>, userId: string) {
  // Check if profile exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!profile) {
    await supabase.from('profiles').insert({ id: userId });
  }

  // Check if personal workspace exists
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .eq('type', 'personal')
    .single();

  if (!workspace) {
    await supabase.from('workspaces').insert({
      name: 'Personal',
      slug: `personal-${nanoid(8)}`,
      type: 'personal',
      owner_id: userId,
    });
  }

  // Check if user has an organization (as owner)
  const { data: orgMembership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  if (!orgMembership) {
    await supabase.rpc('create_user_organization', {
      p_user_id: userId,
      p_name: 'Personal',
    });
  }
}

// Determine the effective viewer type for a share
function getEffectiveViewerType(share: DashboardShare, userEmail: string, ownerEmail: string): 'internal' | 'external' {
  // If explicitly set (not auto), use that
  if (share.viewer_type === 'internal') return 'internal';
  if (share.viewer_type === 'external') return 'external';

  // Auto-detect based on domain
  const userDomain = userEmail.toLowerCase().split('@')[1];
  const ownerDomain = ownerEmail.toLowerCase().split('@')[1];

  if (share.share_type === 'domain') {
    return share.share_value.toLowerCase() === ownerDomain ? 'internal' : 'external';
  } else {
    return userDomain === ownerDomain ? 'internal' : 'external';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code, dashboardSlug } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Valid 6-digit code is required' }, { status: 400 });
    }

    if (!dashboardSlug || typeof dashboardSlug !== 'string') {
      return NextResponse.json({ error: 'Dashboard slug is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = createAdminClient();

    // Get the most recent unused code for this email
    const { data: latestCode } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Check for too many failed attempts
    if (latestCode && (latestCode.attempts || 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new code.' },
        { status: 429 }
      );
    }

    // Find a valid, unused code that matches
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('code', code)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (fetchError || !otpRecord) {
      // Increment attempt counter on the latest code
      if (latestCode) {
        await supabase
          .from('otp_codes')
          .update({ attempts: (latestCode.attempts || 0) + 1 })
          .eq('id', latestCode.id);
      }
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      );
    }

    // Mark the code as used
    await supabase
      .from('otp_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    // Look up the dashboard and its shares
    const { data: dashboard, error: dashboardError } = await supabase
      .from('dashboards')
      .select('id, workspaces!inner(owner_id)')
      .eq('slug', dashboardSlug)
      .single();

    if (dashboardError || !dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboardData = dashboard as unknown as { id: string; workspaces: { owner_id: string } };

    // Get the owner's email for domain comparison and ownership check
    const { data: ownerUser } = await supabase.auth.admin.getUserById(dashboardData.workspaces.owner_id);
    const ownerEmail = ownerUser?.user?.email?.toLowerCase() || '';

    // Check if this user is the owner
    const isOwner = normalizedEmail === ownerEmail;

    // Find the share that matches this user's email (only needed if not owner)
    let matchingShare: DashboardShare | undefined;

    if (!isOwner) {
      const { data: shares } = await supabase
        .from('dashboard_shares')
        .select('*')
        .eq('dashboard_id', dashboardData.id);

      const userDomain = normalizedEmail.split('@')[1];
      matchingShare = (shares as DashboardShare[] | null)?.find((share) => {
        if (share.share_type === 'email') {
          return share.share_value === normalizedEmail;
        } else if (share.share_type === 'domain') {
          return share.share_value === userDomain;
        }
        return false;
      });

      if (!matchingShare) {
        return NextResponse.json(
          { error: 'You do not have access to this dashboard' },
          { status: 403 }
        );
      }
    }

    // Determine effective viewer type
    // Owners are always internal users
    const effectiveViewerType = isOwner ? 'internal' : getEffectiveViewerType(matchingShare!, normalizedEmail, ownerEmail);

    if (effectiveViewerType === 'internal') {
      // Internal user: Create/get Supabase account, return magic link token
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      let isNewUser = false;
      let userId: string;

      if (!existingUser) {
        // Create new user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true,
        });

        if (createError || !newUser.user) {
          console.error('Failed to create user:', createError);
          return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
        }

        userId = newUser.user.id;
        isNewUser = true;
      } else {
        userId = existingUser.id;
      }

      // Ensure profile and workspace exist
      await ensureUserSetup(supabase, userId);

      // Generate a magic link for signing in
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
      });

      if (linkError || !linkData) {
        console.error('Failed to generate sign-in link:', linkError);
        return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
      }

      // Send welcome email and admin notification for new users
      if (isNewUser) {
        sendWelcomeEmail({ to: normalizedEmail }).catch((err) => {
          console.error('Failed to send welcome email:', err);
        });
        sendNewUserNotificationEmail({ userEmail: normalizedEmail }).catch((err) => {
          console.error('Failed to send new user notification email:', err);
        });
      }

      const { properties } = linkData;

      return NextResponse.json({
        success: true,
        viewerType: 'internal',
        isNewUser,
        token_hash: properties.hashed_token,
        verification_type: 'magiclink',
      });
    } else {
      // External viewer: Create session token, no Supabase account
      const { token, hash } = generateSessionToken();
      const expiresAt = new Date(Date.now() + EXTERNAL_SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

      // Store the session
      const { error: sessionError } = await supabase
        .from('external_viewer_sessions')
        .insert({
          email: normalizedEmail,
          dashboard_id: dashboardData.id,
          token_hash: hash,
          expires_at: expiresAt.toISOString(),
        });

      if (sessionError) {
        console.error('Failed to create external session:', sessionError);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        viewerType: 'external',
        isNewUser: false,
        external_session_token: token,
        expires_at: expiresAt.toISOString(),
      });
    }
  } catch (error) {
    console.error('Error in verify-share-access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
