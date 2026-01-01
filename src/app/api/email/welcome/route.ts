import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

// This endpoint can be called by Supabase Auth Hook on user signup
export async function POST(request: Request) {
  try {
    // Verify the request is from Supabase or has valid auth
    const authHeader = request.headers.get('authorization');
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    await sendWelcomeEmail({ to: email });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
