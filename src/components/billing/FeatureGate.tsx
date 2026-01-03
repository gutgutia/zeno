'use client';

import { ReactNode } from 'react';
import type { PlanFeatures } from '@/app/api/plan/route';
import { UpgradePrompt } from './UpgradePrompt';

type FeatureKey = keyof PlanFeatures;

interface FeatureGateProps {
  feature: FeatureKey;
  features: PlanFeatures;
  requiredPlan: 'starter' | 'pro';
  title?: string;
  description?: string;
  children: ReactNode;
  fallback?: ReactNode;
  mode?: 'block' | 'overlay';
}

const DEFAULT_DESCRIPTIONS: Partial<Record<FeatureKey, string>> = {
  team_members: 'Invite team members to collaborate on dashboards.',
  custom_subdomain: 'Get a custom subdomain like yourcompany.zeno.fyi',
  custom_domain: 'Use your own domain for shared dashboards.',
  custom_branding: 'Add your logo and brand colors to dashboards.',
  remove_zeno_branding: 'Remove Zeno branding from shared dashboards.',
  google_sheets: 'Import data directly from Google Sheets with auto-sync.',
  scheduled_refresh: 'Automatically refresh dashboard data on a schedule.',
  pdf_export: 'Export dashboards as PDF documents.',
};

const DEFAULT_TITLES: Partial<Record<FeatureKey, string>> = {
  team_members: 'Team Collaboration',
  custom_subdomain: 'Custom Subdomain',
  custom_domain: 'Custom Domain',
  custom_branding: 'Custom Branding',
  remove_zeno_branding: 'Remove Branding',
  google_sheets: 'Google Sheets Integration',
  scheduled_refresh: 'Scheduled Refresh',
  pdf_export: 'PDF Export',
};

export function FeatureGate({
  feature,
  features,
  requiredPlan,
  title,
  description,
  children,
  fallback,
  mode = 'block',
}: FeatureGateProps) {
  const hasFeature = features[feature];

  if (hasFeature) {
    return <>{children}</>;
  }

  // Use custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  const displayTitle = title || DEFAULT_TITLES[feature] || 'Premium Feature';
  const displayDescription =
    description || DEFAULT_DESCRIPTIONS[feature] || `This feature requires a ${requiredPlan} plan.`;

  if (mode === 'overlay') {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none blur-[1px]">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-lg">
          <div className="text-center p-4 max-w-xs">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded-full mb-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Feature
            </span>
            <p className="text-sm text-[var(--color-gray-600)]">{displayDescription}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <UpgradePrompt
      title={displayTitle}
      description={displayDescription}
      requiredPlan={requiredPlan}
    />
  );
}
