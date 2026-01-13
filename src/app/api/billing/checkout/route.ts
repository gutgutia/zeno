import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getStripe, PRICE_IDS, CREDIT_PACK_PRICES, CREDIT_PACK_AMOUNTS } from '@/lib/stripe';
import type { PlanType, BillingCycle, CreditPackSize } from '@/lib/stripe';
import type Stripe from 'stripe';

// Helper to ensure user has an organization for subscriptions
async function ensureOrganization(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, userEmail: string): Promise<string> {
  // Check if user already has an organization
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingMembership } = await (supabase as any)
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .limit(1)
    .single();

  if (existingMembership?.organization_id) {
    return existingMembership.organization_id;
  }

  // Create a new organization for this user
  const orgName = userEmail.split('@')[0] + "'s Workspace";
  const slug = userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString(36);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newOrg, error: orgError } = await (supabase as any)
    .from('organizations')
    .insert({
      name: orgName,
      slug,
      owner_id: userId,
      billing_email: userEmail,
      plan_type: 'free',
      seats_purchased: 1,
    })
    .select('id')
    .single();

  if (orgError || !newOrg) {
    console.error('Failed to create organization:', orgError);
    throw new Error('Failed to create organization');
  }

  // Add user as owner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('organization_members')
    .insert({
      organization_id: newOrg.id,
      user_id: userId,
      role: 'owner',
      accepted_at: new Date().toISOString(),
    });

  // Create organization credits record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('organization_credits')
    .insert({
      organization_id: newOrg.id,
      balance: 0,
      lifetime_credits: 0,
      lifetime_used: 0,
    });

  console.log(`Created organization ${newOrg.id} for user ${userId}`);
  return newOrg.id;
}

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
    let {
      type,              // 'subscription' or 'credit_pack'
      plan,              // For subscriptions: 'starter', 'pro', 'enterprise'
      billing_cycle,     // 'monthly' or 'annual'
      pack_size,         // For credit packs: 'small', 'medium', 'large'
      organization_id,   // Optional: org to apply credits/subscription to
      seats = 1,         // Number of seats for subscription
      return_url,        // Optional: custom return URL after purchase
    } = body;

    // For subscriptions, ensure organization exists
    if (type === 'subscription' && !organization_id) {
      organization_id = await ensureOrganization(supabase, user.id, user.email || '');
    }

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
        const customer = await getStripe().customers.create({
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
        const customer = await getStripe().customers.create({
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

      // Check if org already has an active subscription - if so, update it instead of creating new
      if (organization_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orgData } = await (supabase as any)
          .from('organizations')
          .select('stripe_subscription_id, plan_type, seats_purchased')
          .eq('id', organization_id)
          .single();

        if (orgData?.stripe_subscription_id) {
          try {
            // Get the existing subscription
            const existingSubscription = await getStripe().subscriptions.retrieve(
              orgData.stripe_subscription_id
            );

            // Only update if subscription is active or trialing
            if (['active', 'trialing'].includes(existingSubscription.status)) {
              const oldPlan = orgData.plan_type;
              const oldSeats = orgData.seats_purchased || 1;

              // Update the subscription to the new plan
              // Use 'always_invoice' to charge immediately for the upgrade
              const updatedSubscription = await getStripe().subscriptions.update(
                orgData.stripe_subscription_id,
                {
                  items: [
                    {
                      id: existingSubscription.items.data[0].id,
                      price: priceId,
                      quantity: seats,
                    },
                  ],
                  metadata: {
                    organization_id: organization_id || '',
                    user_id: user.id,
                    plan,
                    seats: seats.toString(),
                  },
                  proration_behavior: 'always_invoice',
                  payment_behavior: 'allow_incomplete',
                }
              );

              // Update org in database immediately
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any)
                .from('organizations')
                .update({
                  plan_type: plan,
                  seats_purchased: seats,
                  billing_cycle: billing_cycle === 'annual' ? 'annual' : 'monthly',
                })
                .eq('id', organization_id);

              // Calculate and add credit difference for upgrades
              // Credits per seat: starter=100, pro=250, enterprise=500
              const creditsPerPlan: Record<string, number> = {
                free: 0,
                starter: 100,
                pro: 250,
                enterprise: 500,
              };

              const oldCredits = (creditsPerPlan[oldPlan] || 0) * oldSeats;
              const newCredits = (creditsPerPlan[plan] || 0) * seats;
              const creditDifference = newCredits - oldCredits;

              // Only add credits if upgrading (positive difference)
              if (creditDifference > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any).rpc('add_credits', {
                  p_user_id: null,
                  p_org_id: organization_id,
                  p_amount: creditDifference,
                  p_transaction_type: 'monthly_refill',
                  p_description: `Plan upgrade: +${creditDifference} credits (${oldPlan} → ${plan})`,
                });

                console.log(`[Checkout] Added ${creditDifference} credits for upgrade from ${oldPlan} to ${plan}`);
              }

              console.log(`[Checkout] Updated subscription ${updatedSubscription.id} to plan: ${plan}`);

              // Return success without redirect - the plan is already updated
              return NextResponse.json({
                success: true,
                message: creditDifference > 0
                  ? `Upgraded to ${plan}! +${creditDifference} credits added.`
                  : 'Subscription updated successfully',
                subscription_id: updatedSubscription.id,
                credits_added: creditDifference > 0 ? creditDifference : 0,
              });
            }
          } catch (error) {
            const stripeError = error as Stripe.errors.StripeError;
            // If subscription doesn't exist or is canceled, fall through to create new one
            console.log(`[Checkout] Existing subscription not usable: ${stripeError.message}`);
          }
        }
      }

      // No existing subscription or it's not active - create new checkout
      const session = await getStripe().checkout.sessions.create({
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

      // Determine success URL - use custom return_url if provided
      const successUrl = return_url
        ? `${baseUrl}${return_url}?credits_purchased=true&credits=${creditAmount}&session_id={CHECKOUT_SESSION_ID}`
        : `${baseUrl}/settings/billing?success=true&credits=${creditAmount}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = return_url
        ? `${baseUrl}${return_url}?canceled=true`
        : `${baseUrl}/settings/billing?canceled=true`;

      const session = await getStripe().checkout.sessions.create({
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
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return NextResponse.json({ url: session.url });
    }
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
