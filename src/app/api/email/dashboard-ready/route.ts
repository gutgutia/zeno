import { NextResponse } from 'next/server';
import { sendDashboardReadyEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, title, dashboardUrl } = body;

    if (!email || !title || !dashboardUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: email, title, dashboardUrl' },
        { status: 400 }
      );
    }

    // Extract dashboard slug from URL (expects /d/slug format)
    const dashboardSlug = dashboardUrl.split('/').pop() || '';

    await sendDashboardReadyEmail({
      to: email,
      dashboardTitle: title,
      dashboardSlug,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending dashboard ready email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

