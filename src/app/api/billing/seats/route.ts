import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

// POST /api/billing/seats - Update seat count for subscription
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
    const { organization_id, seats } = body;

    if (!organization_id || !seats || seats < 1) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Verify user is owner/admin of the organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only owners and admins can manage seats' }, { status: 403 });
    }

    // Get organization with subscription info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (supabase as any)
      .from('organizations')
      .select('stripe_subscription_id, seats_purchased, plan_type')
      .eq('id', organization_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if organization has an active subscription
    if (!org.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription. Please upgrade first.' },
        { status: 400 }
      );
    }

    // Check minimum seats (must have at least as many seats as current members)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: currentMembers } = await (supabase as any)
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .not('accepted_at', 'is', null);

    if (seats < (currentMembers || 1)) {
      return NextResponse.json(
        { error: `Cannot reduce seats below current member count (${currentMembers})` },
        { status: 400 }
      );
    }

    // Update Stripe subscription quantity
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);

    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 });
    }

    // Get the subscription item (assuming single item subscription)
    const subscriptionItemId = subscription.items.data[0]?.id;
    if (!subscriptionItemId) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 500 });
    }

    // Update the subscription with new quantity (prorated)
    await stripe.subscriptions.update(org.stripe_subscription_id, {
      items: [
        {
          id: subscriptionItemId,
          quantity: seats,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        ...subscription.metadata,
        seats: seats.toString(),
      },
    });

    // Update organization seats_purchased
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('organizations')
      .update({ seats_purchased: seats })
      .eq('id', organization_id);

    // If adding seats, also add proportional credits for the new seats
    if (seats > org.seats_purchased) {
      const newSeats = seats - org.seats_purchased;
      const creditsPerSeat = org.plan_type === 'enterprise' ? 500 : org.plan_type === 'pro' ? 250 : 100;
      const additionalCredits = creditsPerSeat * newSeats;

      // Add prorated credits for the new seats
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('add_credits', {
        p_user_id: null,
        p_org_id: organization_id,
        p_amount: additionalCredits,
        p_transaction_type: 'monthly_refill',
        p_description: `Added ${newSeats} seat(s): +${additionalCredits} credits`,
      });
    }

    return NextResponse.json({
      success: true,
      seats,
      message: seats > org.seats_purchased
        ? `Added ${seats - org.seats_purchased} seat(s). Your billing will be prorated.`
        : `Reduced to ${seats} seat(s). Your billing will be adjusted.`,
    });
  } catch (error) {
    console.error('Seat update error:', error);
    return NextResponse.json({ error: 'Failed to update seats' }, { status: 500 });
  }
}

// GET /api/billing/seats - Get seat information
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Verify user is a member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Get organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (supabase as any)
      .from('organizations')
      .select('seats_purchased, plan_type, stripe_subscription_id')
      .eq('id', organizationId)
      .single();

    // Count current members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: currentMembers } = await (supabase as any)
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .not('accepted_at', 'is', null);

    // Count pending invitations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: pendingInvitations } = await (supabase as any)
      .from('organization_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    // Calculate credits per seat
    const creditsPerSeat = org?.plan_type === 'enterprise' ? 500 : org?.plan_type === 'pro' ? 250 : 100;

    // Calculate seat price (Starter = $10, Pro = $25)
    const pricePerSeat = org?.plan_type === 'enterprise' ? 100 : org?.plan_type === 'pro' ? 25 : 10;

    return NextResponse.json({
      seats_purchased: org?.seats_purchased || 1,
      seats_used: currentMembers || 1,
      seats_pending: pendingInvitations || 0,
      seats_available: Math.max(0, (org?.seats_purchased || 1) - (currentMembers || 1) - (pendingInvitations || 0)),
      plan_type: org?.plan_type || 'free',
      has_subscription: !!org?.stripe_subscription_id,
      credits_per_seat: creditsPerSeat,
      price_per_seat: pricePerSeat,
    });
  } catch (error) {
    console.error('Seat info error:', error);
    return NextResponse.json({ error: 'Failed to get seat info' }, { status: 500 });
  }
}
