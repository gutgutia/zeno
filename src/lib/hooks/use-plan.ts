'use client';

import { useState, useEffect } from 'react';
import type { PlanResponse, PlanFeatures } from '@/app/api/plan/route';
import type { PlanType } from '@/lib/credits';

interface UsePlanReturn {
  plan: PlanType;
  features: PlanFeatures;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_FEATURES: PlanFeatures = {
  team_members: false,
  custom_subdomain: false,
  custom_domain: false,
  custom_branding: false,
  remove_zeno_branding: false,
  google_sheets: false,
  scheduled_refresh: false,
  pdf_export: false,
};

export function usePlan(): UsePlanReturn {
  const [plan, setPlan] = useState<PlanType>('free');
  const [features, setFeatures] = useState<PlanFeatures>(DEFAULT_FEATURES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/plan');

      if (!response.ok) {
        throw new Error('Failed to fetch plan');
      }

      const data: PlanResponse = await response.json();
      setPlan(data.plan);
      setFeatures(data.features);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Keep default free plan on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, []);

  return {
    plan,
    features,
    isLoading,
    error,
    refetch: fetchPlan,
  };
}
