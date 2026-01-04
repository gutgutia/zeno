'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UpgradeModal } from './UpgradeModal';

interface UpgradePromptProps {
  title?: string;
  description: string;
  requiredPlan: 'starter' | 'pro';
  className?: string;
  compact?: boolean;
}

const PLAN_PRICES = {
  starter: '$10',
  pro: '$24',
};

export function UpgradePrompt({
  title,
  description,
  requiredPlan,
  className = '',
  compact = false,
}: UpgradePromptProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const planName = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1);

  if (compact) {
    return (
      <>
        <div className={`flex items-center gap-3 p-4 bg-gradient-to-r from-[var(--color-primary)]/5 to-[var(--color-primary)]/10 rounded-lg border border-[var(--color-primary)]/20 ${className}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[var(--color-gray-700)]">{description}</p>
          </div>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            Upgrade
          </Button>
        </div>
        <UpgradeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          reason="feature"
          featureName={title || description}
        />
      </>
    );
  }

  return (
    <>
      <div className={`p-6 bg-gradient-to-br from-[var(--color-primary)]/5 via-white to-[var(--color-primary)]/5 rounded-xl border border-[var(--color-primary)]/20 ${className}`}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-[var(--color-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div className="flex-1">
            {title && (
              <h3 className="font-semibold text-[var(--color-gray-900)] mb-1">
                {title}
              </h3>
            )}
            <p className="text-sm text-[var(--color-gray-600)] mb-4">
              {description}
            </p>
            <Button onClick={() => setIsModalOpen(true)}>
              Upgrade to {planName} - {PLAN_PRICES[requiredPlan]}/mo
            </Button>
          </div>
        </div>
      </div>
      <UpgradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reason="feature"
        featureName={title || description}
      />
    </>
  );
}
