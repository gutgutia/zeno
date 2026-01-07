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

  console.log(`[Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('[Webhook] Processing checkout.session.completed');
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        console.log(`[Webhook] Processing ${event.type}`);
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

  console.log('[Webhook] Subscription metadata:', {
    organizationId,
    userId,
    plan,
    seats,
    subscriptionId: subscription.id,
    status: subscription.status,
  });

  if (organizationId) {
    // Get current org data to check if this is a plan change or renewal
    const { data: currentOrg } = await getSupabaseAdmin()
      .from('organizations')
      .select('plan_type, seats_purchased, stripe_subscription_id')
      .eq('id', organizationId)
      .single();

    // This is a mid-cycle upgrade if:
    // 1. Org already has the same subscription ID (not a new subscription)
    // 2. Plan or seats changed
    // For new subscriptions (checkout redirect), stripe_subscription_id won't match yet
    const isNewSubscription = !currentOrg?.stripe_subscription_id || currentOrg.stripe_subscription_id !== subscription.id;
    const isPlanChange = !isNewSubscription && currentOrg && (currentOrg.plan_type !== plan || currentOrg.seats_purchased !== seats);

    // Check if subscription is scheduled to cancel
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentPeriodEnd = (subscription as any).current_period_end;
    const subscriptionEndsAt = cancelAtPeriodEnd && currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null;

    // Update organization subscription
    console.log(`[Webhook] Updating organization ${organizationId} with plan: ${plan} (isNewSubscription: ${isNewSubscription}, isPlanChange: ${isPlanChange}, cancelAtPeriodEnd: ${cancelAtPeriodEnd})`);

    const { error: updateError } = await getSupabaseAdmin()
      .from('organizations')
      .update({
        stripe_subscription_id: subscription.id,
        plan_type: plan,
        seats_purchased: seats,
        billing_cycle: subscription.items.data[0]?.price?.recurring?.interval === 'year'
          ? 'annual'
          : 'monthly',
        subscription_ends_at: subscriptionEndsAt, // null if not canceling, date if scheduled to cancel
      })
      .eq('id', organizationId);

    if (updateError) {
      console.error('[Webhook] Failed to update organization:', updateError);
    } else {
      console.log(`[Webhook] Successfully updated organization ${organizationId} to plan: ${plan}`);
    }

    // If subscription is active, handle credits
    // Skip credit handling for plan changes - checkout route already handled it
    if (subscription.status === 'active' && !isPlanChange) {
      // Credits per seat: Starter = 100, Pro = 250, Enterprise = 500
      const creditsPerSeat = plan === 'enterprise' ? 500 : plan === 'pro' ? 250 : 100;
      const totalCredits = creditsPerSeat * seats;

      const now = new Date();

      // For NEW subscriptions (Free → Starter/Pro), always give credits
      // For renewals, check if enough time has passed since last refill
      if (isNewSubscription) {
        // New subscription - give full credits for first month
        await getSupabaseAdmin().rpc('add_credits', {
          p_user_id: null,
          p_org_id: organizationId,
          p_amount: totalCredits,
          p_transaction_type: 'monthly_refill',
          p_description: `New subscription: ${totalCredits} credits (${seats} seats × ${creditsPerSeat})`,
        });

        await getSupabaseAdmin()
          .from('organization_credits')
          .update({ last_refill_at: now.toISOString() })
          .eq('organization_id', organizationId);

        console.log(`[Webhook] New subscription - added ${totalCredits} credits for org ${organizationId}`);
      } else {
        // Renewal - check if we need to refill (monthly allocation, even for annual plans)
        const { data: orgCredits } = await getSupabaseAdmin()
          .from('organization_credits')
          .select('last_refill_at')
          .eq('organization_id', organizationId)
          .single();

        const lastRefill = orgCredits?.last_refill_at
          ? new Date(orgCredits.last_refill_at)
          : null;

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

          console.log(`[Webhook] Renewal - refilled ${totalCredits} credits for org ${organizationId}`);
        } else {
          console.log(`[Webhook] Skipping credit refill - last refill was ${lastRefill ? Math.round((now.getTime() - lastRefill.getTime()) / (24 * 60 * 60 * 1000)) : 'never'} days ago`);
        }
      }
    } else if (isPlanChange) {
      console.log('[Webhook] Skipping credit handling - plan change already handled by checkout');
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
  // This fires when subscription actually ends (after cancel_at_period_end expires)
  const metadata = subscription.metadata || {};
  const organizationId = metadata.organization_id;
  const userId = metadata.user_id;

  if (organizationId) {
    // Downgrade org to free plan - credits remain in account
    await getSupabaseAdmin()
      .from('organizations')
      .update({
        stripe_subscription_id: null,
        plan_type: 'free',
        subscription_ends_at: null, // Clear the scheduled end date
      })
      .eq('id', organizationId);

    console.log(`[Webhook] Subscription ended for org ${organizationId} - downgraded to free plan`);
  } else if (userId) {
    // Downgrade user to free
    await getSupabaseAdmin()
      .from('profiles')
      .update({ plan_type: 'free' })
      .eq('id', userId);

    console.log(`[Webhook] Subscription ended for user ${userId} - downgraded to free plan`);
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
