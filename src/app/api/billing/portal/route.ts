import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

// POST /api/billing/portal - Create a Stripe Customer Portal session
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organization_id } = body;

    let customerId: string | null = null;

    if (organization_id) {
      // Get org's Stripe customer ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', organization_id)
        .single();

      // Verify user is admin/owner
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership } = await (supabase as any)
        .from('organization_members')
        .select('role')
        .eq('organization_id', organization_id)
        .eq('user_id', user.id)
        .single();

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return NextResponse.json(
          { error: 'Only admins can manage billing' },
          { status: 403 }
        );
      }

      customerId = org?.stripe_customer_id;
    } else {
      // Get user's Stripe customer ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      customerId = profile?.stripe_customer_id;
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account found. Please make a purchase first.' },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings/billing?from_portal=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
