'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CreditInfo {
  balance: number;
  plan: string;
  limits?: {
    dashboards: {
      current: number;
      limit: number | null;
      can_create: boolean;
    };
  };
}

interface CreditDisplayProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function CreditDisplay({ variant = 'compact', className = '' }: CreditDisplayProps) {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCredits();

    // Listen for credit updates (dispatched when plan changes or org switches)
    const handleCreditsUpdated = () => {
      fetchCredits();
    };

    window.addEventListener('credits-updated', handleCreditsUpdated);
    window.addEventListener('organization-changed', handleCreditsUpdated);
    window.addEventListener('focus', handleCreditsUpdated);

    return () => {
      window.removeEventListener('credits-updated', handleCreditsUpdated);
      window.removeEventListener('organization-changed', handleCreditsUpdated);
      window.removeEventListener('focus', handleCreditsUpdated);
    };
  }, []);

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCreditInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-5 w-20 bg-[var(--color-gray-200)] rounded" />
      </div>
    );
  }

  if (!creditInfo) {
    return null;
  }

  const isLowCredits = creditInfo.balance < 20;
  const planLabel = creditInfo.plan.charAt(0).toUpperCase() + creditInfo.plan.slice(1);

  if (variant === 'compact') {
    return (
      <Link
        href="/settings/billing"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-gray-100)] transition-colors ${className}`}
      >
        <svg
          className={`w-4 h-4 ${isLowCredits ? 'text-amber-500' : 'text-[var(--color-primary)]'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className={`text-sm font-medium ${isLowCredits ? 'text-amber-600' : 'text-[var(--color-gray-700)]'}`}>
          {creditInfo.balance}
        </span>
      </Link>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-[var(--color-gray-200)] p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-[var(--color-gray-900)]">Credits</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-gray-100)] text-[var(--color-gray-600)]">
          {planLabel}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-[var(--color-gray-900)]">
          {creditInfo.balance}
        </span>
        <span className="text-sm text-[var(--color-gray-500)]">credits remaining</span>
      </div>

      {isLowCredits && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg mb-3">
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm text-amber-700">Running low on credits</span>
        </div>
      )}

      {creditInfo.limits?.dashboards && (
        <div className="text-sm text-[var(--color-gray-600)] mb-3">
          <span className="font-medium">{creditInfo.limits.dashboards.current}</span>
          {creditInfo.limits.dashboards.limit && (
            <>
              <span> / {creditInfo.limits.dashboards.limit}</span>
            </>
          )}
          <span> dashboards</span>
        </div>
      )}

      <Link
        href="/settings/billing"
        className="block w-full text-center py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 rounded-lg transition-colors"
      >
        {isLowCredits ? 'Get More Credits' : 'Manage Billing'}
      </Link>
    </div>
  );
}
