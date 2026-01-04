import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getUserPlan, type PlanType } from '@/lib/credits';

export interface PlanFeatures {
  team_members: boolean;
  custom_subdomain: boolean;
  custom_domain: boolean;
  custom_branding: boolean;
  remove_zeno_branding: boolean;
  google_sheets: boolean;
  scheduled_refresh: boolean;
  pdf_export: boolean;
}

export interface PlanResponse {
  plan: PlanType;
  features: PlanFeatures;
}

// Define features per plan
const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  free: {
    team_members: false,
    custom_subdomain: false,
    custom_domain: false,
    custom_branding: false,
    remove_zeno_branding: false,
    google_sheets: false,
    scheduled_refresh: false,
    pdf_export: false,
  },
  starter: {
    team_members: true,
    custom_subdomain: true,
    custom_domain: false,
    custom_branding: false,
    remove_zeno_branding: false,
    google_sheets: false,
    scheduled_refresh: false,
    pdf_export: false,
  },
  pro: {
    team_members: true,
    custom_subdomain: true,
    custom_domain: true,
    custom_branding: true,
    remove_zeno_branding: true,
    google_sheets: true,
    scheduled_refresh: true,
    pdf_export: true,
  },
  enterprise: {
    team_members: true,
    custom_subdomain: true,
    custom_domain: true,
    custom_branding: true,
    remove_zeno_branding: true,
    google_sheets: true,
    scheduled_refresh: true,
    pdf_export: true,
  },
};

// GET /api/plan - Get current user's plan and features
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

    const plan = await getUserPlan(user.id);
    const features = PLAN_FEATURES[plan];

    return NextResponse.json({
      plan,
      features,
    } as PlanResponse);
  } catch (error) {
    console.error('Plan fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
