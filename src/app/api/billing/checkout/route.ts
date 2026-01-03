import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { stripe, PRICE_IDS, CREDIT_PACK_PRICES, CREDIT_PACK_AMOUNTS } from '@/lib/stripe';
import type { PlanType, BillingCycle, CreditPackSize } from '@/lib/stripe';

// POST /api/billing/checkout - Create a Stripe Checkout session
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
    const {
      type,              // 'subscription' or 'credit_pack'
      plan,              // For subscriptions: 'starter', 'pro', 'enterprise'
      billing_cycle,     // 'monthly' or 'annual'
      pack_size,         // For credit packs: 'small', 'medium', 'large'
      organization_id,   // Optional: org to apply credits/subscription to
      seats = 1,         // Number of seats for subscription
    } = body;

    if (!type || (type !== 'subscription' && type !== 'credit_pack')) {
      return NextResponse.json({ error: 'Invalid checkout type' }, { status: 400 });
    }

    // Get or create Stripe customer
    let customerId: string | undefined;

    if (organization_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('stripe_customer_id, billing_email, name')
        .eq('id', organization_id)
        .single();

      if (org?.stripe_customer_id) {
        customerId = org.stripe_customer_id;
      } else {
        // Create new customer for org
        const customer = await stripe.customers.create({
          email: org?.billing_email || user.email,
          name: org?.name,
          metadata: {
            organization_id,
            user_id: user.id,
          },
        });
        customerId = customer.id;

        // Save customer ID to org
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('organizations')
          .update({ stripe_customer_id: customer.id })
          .eq('id', organization_id);
      }
    } else {
      // Get user's Stripe customer ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      if (profile?.stripe_customer_id) {
        customerId = profile.stripe_customer_id;
      } else {
        // Create new customer
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            user_id: user.id,
          },
        });
        customerId = customer.id;

        // Save customer ID
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('profiles')
          .update({ stripe_customer_id: customer.id })
          .eq('id', user.id);
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (type === 'subscription') {
      if (!plan || !billing_cycle) {
        return NextResponse.json(
          { error: 'Plan and billing cycle are required for subscriptions' },
          { status: 400 }
        );
      }

      const priceId = PRICE_IDS[plan as PlanType]?.[billing_cycle as BillingCycle];
      if (!priceId) {
        return NextResponse.json({ error: 'Invalid plan or billing cycle' }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: seats,
          },
        ],
        subscription_data: {
          metadata: {
            organization_id: organization_id || '',
            user_id: user.id,
            plan,
            seats: seats.toString(),
          },
        },
        success_url: `${baseUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/settings/billing?canceled=true`,
        allow_promotion_codes: true,
      });

      return NextResponse.json({ url: session.url });
    } else {
      // Credit pack purchase
      if (!pack_size) {
        return NextResponse.json({ error: 'Pack size is required' }, { status: 400 });
      }

      const priceId = CREDIT_PACK_PRICES[pack_size as CreditPackSize];
      const creditAmount = CREDIT_PACK_AMOUNTS[pack_size as CreditPackSize];

      if (!priceId || !creditAmount) {
        return NextResponse.json({ error: 'Invalid pack size' }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: {
          type: 'credit_pack',
          organization_id: organization_id || '',
          user_id: user.id,
          credits: creditAmount.toString(),
          pack_size,
        },
        success_url: `${baseUrl}/settings/billing?success=true&credits=${creditAmount}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/settings/billing?canceled=true`,
      });

      return NextResponse.json({ url: session.url });
    }
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
