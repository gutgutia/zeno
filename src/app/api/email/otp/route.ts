import { NextResponse } from 'next/server';
import { sendOTPEmail } from '@/lib/email';

// This endpoint can be called by Supabase Auth Hook or custom auth flow
export async function POST(request: Request) {
  try {
    // Verify the request is from Supabase or has valid auth
    const authHeader = request.headers.get('authorization');
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, token } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Missing email or token' },
        { status: 400 }
      );
    }

    await sendOTPEmail({
      to: email,
      code: token,
      expiresInMinutes: 10,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
