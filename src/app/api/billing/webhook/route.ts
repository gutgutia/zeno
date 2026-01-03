import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

// Lazy initialization to avoid build errors
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase environment variables not configured');
  }
  return createClient(url, key);
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// POST /api/billing/webhook - Handle Stripe webhooks
export async function POST(request: Request) {
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePayment(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};

  if (metadata.type === 'credit_pack') {
    // Credit pack purchase
    const credits = parseInt(metadata.credits || '0', 10);
    const organizationId = metadata.organization_id || null;
    const userId = metadata.user_id;

    if (credits > 0 && userId) {
      // Add credits using RPC function
      await getSupabaseAdmin().rpc('add_credits', {
        p_user_id: organizationId ? null : userId,
        p_org_id: organizationId || null,
        p_amount: credits,
        p_transaction_type: 'credit_pack',
        p_description: `Purchased ${credits} credit pack`,
      });

      // Record the purchase
      await getSupabaseAdmin().from('credit_purchases').insert({
        organization_id: organizationId || null,
        user_id: userId,
        credits,
        amount_cents: session.amount_total || 0,
        stripe_payment_intent_id: session.payment_intent as string,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      console.log(`Added ${credits} credits for user ${userId}`);
    }
  }
  // Subscription handling is done in subscription events
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata || {};
  const organizationId = metadata.organization_id;
  const userId = metadata.user_id;
  const plan = metadata.plan || 'starter';
  const seats = parseInt(metadata.seats || '1', 10);

  if (organizationId) {
    // Update organization subscription
    await getSupabaseAdmin()
      .from('organizations')
      .update({
        stripe_subscription_id: subscription.id,
        plan_type: plan,
        seats_purchased: seats,
        billing_cycle: subscription.items.data[0]?.price?.recurring?.interval === 'year'
          ? 'annual'
          : 'monthly',
      })
      .eq('id', organizationId);

    // If subscription is active, refill credits
    if (subscription.status === 'active') {
      const creditsPerSeat = plan === 'pro' ? 500 : plan === 'enterprise' ? 1000 : 200;
      const totalCredits = creditsPerSeat * seats;

      // Check if we need to refill (first activation or renewal)
      const { data: orgCredits } = await getSupabaseAdmin()
        .from('organization_credits')
        .select('last_refill_at')
        .eq('organization_id', organizationId)
        .single();

      const lastRefill = orgCredits?.last_refill_at
        ? new Date(orgCredits.last_refill_at)
        : null;
      const now = new Date();

      // Refill if never refilled or last refill was > 25 days ago
      const shouldRefill =
        !lastRefill ||
        now.getTime() - lastRefill.getTime() > 25 * 24 * 60 * 60 * 1000;

      if (shouldRefill) {
        await getSupabaseAdmin().rpc('add_credits', {
          p_user_id: null,
          p_org_id: organizationId,
          p_amount: totalCredits,
          p_transaction_type: 'monthly_refill',
          p_description: `Monthly refill: ${totalCredits} credits (${seats} seats × ${creditsPerSeat})`,
        });

        await getSupabaseAdmin()
          .from('organization_credits')
          .update({ last_refill_at: now.toISOString() })
          .eq('organization_id', organizationId);

        console.log(`Refilled ${totalCredits} credits for org ${organizationId}`);
      }
    }
  } else if (userId) {
    // Individual subscription - update profile
    await getSupabaseAdmin()
      .from('profiles')
      .update({ plan_type: plan })
      .eq('id', userId);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata || {};
  const organizationId = metadata.organization_id;
  const userId = metadata.user_id;

  if (organizationId) {
    // Downgrade org to starter (keep org but remove premium features)
    await getSupabaseAdmin()
      .from('organizations')
      .update({
        stripe_subscription_id: null,
        plan_type: 'team', // Basic team, no premium
      })
      .eq('id', organizationId);

    console.log(`Subscription cancelled for org ${organizationId}`);
  } else if (userId) {
    // Downgrade user to free
    await getSupabaseAdmin()
      .from('profiles')
      .update({ plan_type: 'free' })
      .eq('id', userId);

    console.log(`Subscription cancelled for user ${userId}`);
  }
}

async function handleInvoicePayment(invoice: Stripe.Invoice) {
  // Log successful payment
  console.log(`Payment succeeded for invoice ${invoice.id}`);

  // Could send receipt email here
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Log failed payment
  console.error(`Payment failed for invoice ${invoice.id}`);

  // Could send payment failure notification here
  const customerId = invoice.customer as string;

  // Get customer to notify
  const customer = await getStripe().customers.retrieve(customerId);

  if (customer && !customer.deleted) {
    // TODO: Send email notification about failed payment
    console.log(`Should notify ${customer.email} about failed payment`);
  }
}
