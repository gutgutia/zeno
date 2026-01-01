import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWelcomeEmail } from '@/lib/email/send';

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

    // Find a valid, unused code
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('code', code)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (fetchError || !otpRecord) {
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

    if (!existingUser) {
      // Create new user
      const { error: createError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true, // Auto-confirm since we verified via OTP
      });

      if (createError) {
        console.error('Failed to create user:', createError);
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
      }

      isNewUser = true;
    }

    // Generate a magic link for signing in
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    });

    if (linkError || !linkData) {
      console.error('Failed to generate sign-in link:', linkError);
      return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
    }

    // Send welcome email for new users (async, don't wait)
    if (isNewUser) {
      sendWelcomeEmail({ to: normalizedEmail }).catch((err) => {
        console.error('Failed to send welcome email:', err);
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
