import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOTPEmail } from '@/lib/email/send';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

// IP-based rate limit: 10 requests per 5 minutes
const IP_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 5 * 60 * 1000, // 5 minutes
};

// Generate a cryptographically secure 6-digit OTP code
function generateOTP(): string {
  return randomInt(100000, 999999).toString();
}

export async function POST(request: Request) {
  try {
    // Check IP-based rate limit first (before parsing body)
    const clientIP = getClientIP(request);
    const ipRateLimit = checkRateLimit(clientIP, 'send-otp-ip', IP_RATE_LIMIT);

    if (!ipRateLimit.allowed) {
      const retryAfterSeconds = Math.ceil((ipRateLimit.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfterSeconds.toString(),
            'X-RateLimit-Limit': ipRateLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(ipRateLimit.resetTime / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = createAdminClient();

    // Per-email rate limiting: check if there's a recent code (within last minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentCode } = await supabase
      .from('otp_codes')
      .select('id')
      .eq('email', normalizedEmail)
      .gt('created_at', oneMinuteAgo)
      .single();

    if (recentCode) {
      return NextResponse.json(
        { error: 'Please wait before requesting another code' },
        { status: 429 }
      );
    }

    // Invalidate any existing unused codes for this email
    await supabase
      .from('otp_codes')
      .delete()
      .eq('email', normalizedEmail)
      .is('used_at', null);

    // Generate new code
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the code
    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        email: normalizedEmail,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to store OTP:', insertError);
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    // Send email via Resend
    try {
      await sendOTPEmail({
        to: normalizedEmail,
        code,
        expiresInMinutes: 10,
      });
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      // Clean up the stored code since email failed
      await supabase
        .from('otp_codes')
        .delete()
        .eq('email', normalizedEmail)
        .eq('code', code);

      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in send-otp:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
