import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCreditBalance, getTransactionHistory, getUserPlan, canCreateDashboard } from '@/lib/credits';
import { cookies } from 'next/headers';

// GET /api/credits - Get user's credit balance and usage info
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current organization from cookie (set by organization context)
    const cookieStore = await cookies();
    const currentOrgId = cookieStore.get('zeno_current_org')?.value || null;

    // Get credit balance for the current organization
    const balance = await getCreditBalance(user.id, currentOrgId);

    if (!balance) {
      return NextResponse.json({ error: 'Credit balance not found' }, { status: 404 });
    }

    // Get user's plan
    const plan = await getUserPlan(user.id);

    // Get dashboard creation status
    const dashboardStatus = await canCreateDashboard(user.id);

    // Get recent transactions
    const transactions = await getTransactionHistory(
      user.id,
      balance.organization_id,
      10
    );

    // Get subscription details (end date, billing cycle, last refill)
    let subscriptionEndsAt: string | null = null;
    let billingCycle: 'monthly' | 'annual' | null = null;
    let lastRefillAt: string | null = null;
    if (balance.organization_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('subscription_ends_at, billing_cycle')
        .eq('id', balance.organization_id)
        .single();
      subscriptionEndsAt = org?.subscription_ends_at || null;
      billingCycle = org?.billing_cycle || null;

      // Get last refill date
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orgCredits } = await (supabase as any)
        .from('organization_credits')
        .select('last_refill_at')
        .eq('organization_id', balance.organization_id)
        .single();
      lastRefillAt = orgCredits?.last_refill_at || null;
    }

    return NextResponse.json({
      balance: balance.balance,
      lifetime_credits: balance.lifetime_credits,
      lifetime_used: balance.lifetime_used,
      source: balance.source,
      organization_id: balance.organization_id,
      plan,
      subscription_ends_at: subscriptionEndsAt,
      billing_cycle: billingCycle,
      last_refill_at: lastRefillAt,
      limits: {
        dashboards: {
          current: dashboardStatus.current,
          limit: dashboardStatus.limit,
          can_create: dashboardStatus.allowed,
        },
      },
      recent_transactions: transactions,
    });
  } catch (error) {
    console.error('Credits fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
