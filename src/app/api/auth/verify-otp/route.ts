import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWelcomeEmail, sendNewUserNotificationEmail } from '@/lib/email/send';

const MAX_ATTEMPTS = 5;

// Ensure profile and workspace exist for a user
async function ensureUserSetup(supabase: ReturnType<typeof createAdminClient>, userId: string) {
  // Check if profile exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!profile) {
    // Create profile
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
    // Create personal workspace
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
    // Create default organization using the database function
    // This bypasses RLS via SECURITY DEFINER
    await supabase.rpc('create_user_organization', {
      p_user_id: userId,
      p_name: 'Default',
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Valid 6-digit code is required' }, { status: 400 });
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

    // Check if user exists
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
        email_confirm: true, // Auto-confirm since we verified via OTP
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

    // Ensure profile and workspace exist (trigger might not have fired)
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

    // Send welcome email and admin notification for new users (async, don't wait)
    if (isNewUser) {
      sendWelcomeEmail({ to: normalizedEmail }).catch((err) => {
        console.error('Failed to send welcome email:', err);
      });
      sendNewUserNotificationEmail({ userEmail: normalizedEmail }).catch((err) => {
        console.error('Failed to send new user notification email:', err);
      });
    }

    // Extract the token from the link properties
    // The link contains token_hash and type parameters
    const { properties } = linkData;

    return NextResponse.json({
      success: true,
      isNewUser,
      // Return the hashed token for client-side verification
      token_hash: properties.hashed_token,
      verification_type: 'magiclink',
    });
  } catch (error) {
    console.error('Error in verify-otp:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
