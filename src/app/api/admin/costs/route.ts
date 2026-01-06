import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, any, any>;

// GET /api/admin/costs - Get cost overview and model pricing
export async function GET(request: NextRequest) {
  const supabase = await createClient() as AdminSupabase;

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const view = searchParams.get('view') || 'overview';

  try {
    if (view === 'pricing') {
      // Get model pricing
      const { data: pricing, error } = await supabase
        .from('model_pricing')
        .select('*')
        .order('model_id');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ pricing });
    }

    if (view === 'usage') {
      // Get usage logs with pagination
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      const { data: usage, error, count } = await supabase
        .from('ai_usage_logs')
        .select('*, dashboards(title)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        usage,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    // Default: overview
    // Get aggregate statistics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total cost (all time)
    const { data: totalStats } = await supabase
      .from('ai_usage_logs')
      .select('total_cost_usd, input_tokens, output_tokens')
      .eq('status', 'success');

    // Last 30 days
    const { data: monthStats } = await supabase
      .from('ai_usage_logs')
      .select('total_cost_usd, operation_type')
      .eq('status', 'success')
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Last 7 days
    const { data: weekStats } = await supabase
      .from('ai_usage_logs')
      .select('total_cost_usd')
      .eq('status', 'success')
      .gte('created_at', sevenDaysAgo.toISOString());

    // Operation breakdown (last 30 days)
    const operationBreakdown: Record<string, { count: number; cost: number }> = {
      generation: { count: 0, cost: 0 },
      modification: { count: 0, cost: 0 },
      data_refresh: { count: 0, cost: 0 },
    };

    for (const row of monthStats || []) {
      const op = row.operation_type as keyof typeof operationBreakdown;
      if (operationBreakdown[op]) {
        operationBreakdown[op].count++;
        operationBreakdown[op].cost += parseFloat(row.total_cost_usd || '0');
      }
    }

    // Calculate totals
    const totalCost = (totalStats || []).reduce((sum, row) => sum + parseFloat(row.total_cost_usd || '0'), 0);
    const totalInputTokens = (totalStats || []).reduce((sum, row) => sum + (row.input_tokens || 0), 0);
    const totalOutputTokens = (totalStats || []).reduce((sum, row) => sum + (row.output_tokens || 0), 0);
    const monthCost = (monthStats || []).reduce((sum, row) => sum + parseFloat(row.total_cost_usd || '0'), 0);
    const weekCost = (weekStats || []).reduce((sum, row) => sum + parseFloat(row.total_cost_usd || '0'), 0);

    // Get model pricing
    const { data: pricing } = await supabase
      .from('model_pricing')
      .select('*')
      .eq('is_active', true)
      .order('model_id');

    return NextResponse.json({
      overview: {
        totalCost: Math.round(totalCost * 100) / 100,
        totalInputTokens,
        totalOutputTokens,
        totalOperations: totalStats?.length || 0,
        last30Days: {
          cost: Math.round(monthCost * 100) / 100,
          operations: monthStats?.length || 0,
        },
        last7Days: {
          cost: Math.round(weekCost * 100) / 100,
          operations: weekStats?.length || 0,
        },
        byOperation: operationBreakdown,
      },
      pricing,
    });
  } catch (error) {
    console.error('[Admin Costs] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/costs - Update model pricing
export async function PUT(request: NextRequest) {
  const supabase = await createClient() as AdminSupabase;

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Only super_admin can change pricing
  if (adminUser.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { modelId, inputCostPer1M, outputCostPer1M } = body;

  if (!modelId || inputCostPer1M === undefined || outputCostPer1M === undefined) {
    return NextResponse.json(
      { error: 'modelId, inputCostPer1M, and outputCostPer1M required' },
      { status: 400 }
    );
  }

  // Validate pricing values
  if (inputCostPer1M < 0 || outputCostPer1M < 0) {
    return NextResponse.json({ error: 'Pricing values must be non-negative' }, { status: 400 });
  }

  try {
    // Get old pricing for audit log
    const { data: oldPricing } = await supabase
      .from('model_pricing')
      .select('*')
      .eq('model_id', modelId)
      .single();

    // Update pricing
    const { error } = await supabase
      .from('model_pricing')
      .update({
        input_cost_per_1m_tokens: inputCostPer1M,
        output_cost_per_1m_tokens: outputCostPer1M,
        effective_from: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('model_id', modelId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_user_id: user.id,
      action: 'update_model_pricing',
      target_type: 'model_pricing',
      target_id: modelId,
      old_value: oldPricing,
      new_value: { modelId, inputCostPer1M, outputCostPer1M },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Costs] Error updating pricing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
