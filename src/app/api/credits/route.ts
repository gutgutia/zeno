import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCreditBalance, getTransactionHistory, getUserPlan, canCreateDashboard } from '@/lib/credits';

// GET /api/credits - Get user's credit balance and usage info
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get credit balance
    const balance = await getCreditBalance(user.id);

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

    return NextResponse.json({
      balance: balance.balance,
      lifetime_credits: balance.lifetime_credits,
      lifetime_used: balance.lifetime_used,
      source: balance.source,
      organization_id: balance.organization_id,
      plan,
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
