'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'credits' | 'dashboards' | 'feature';
  featureName?: string;
  creditsNeeded?: number;
  creditsAvailable?: number;
}

const plans = [
  {
    name: 'Starter',
    price: 10,
    priceAnnual: 8,
    credits: '200/seat/mo',
    features: ['Unlimited dashboards', 'Private sharing', 'Custom subdomain', 'Email support'],
    plan: 'starter',
  },
  {
    name: 'Pro',
    price: 24,
    priceAnnual: 20,
    credits: '500/seat/mo',
    features: [
      'Everything in Starter',
      'Remove Zeno branding',
      'Custom domain',
      'Custom branding',
      'Google Sheets integration',
      'Priority support',
    ],
    plan: 'pro',
    popular: true,
  },
];

export function UpgradeModal({
  isOpen,
  onClose,
  reason = 'credits',
  featureName,
  creditsNeeded,
  creditsAvailable,
}: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  const handleUpgrade = async (plan: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          plan,
          billing_cycle: billingCycle,
          seats: 1,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (reason) {
      case 'credits':
        return 'Need More Credits?';
      case 'dashboards':
        return 'Dashboard Limit Reached';
      case 'feature':
        return `Unlock ${featureName || 'This Feature'}`;
      default:
        return 'Upgrade Your Plan';
    }
  };

  const getDescription = () => {
    switch (reason) {
      case 'credits':
        return creditsNeeded && creditsAvailable !== undefined
          ? `You need ${creditsNeeded} credits but only have ${creditsAvailable}. Upgrade for more credits and unlock premium features.`
          : 'Upgrade to get more credits each month and unlock premium features.';
      case 'dashboards':
        return 'You\'ve reached the free plan limit of 3 dashboards. Upgrade to create unlimited dashboards.';
      case 'feature':
        return `${featureName || 'This feature'} is available on paid plans. Upgrade to unlock it.`;
      default:
        return 'Upgrade to unlock more features and get more credits.';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[var(--color-gray-100)] rounded-full p-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-[var(--color-gray-900)] shadow-sm'
                  : 'text-[var(--color-gray-600)]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'annual'
                  ? 'bg-white text-[var(--color-gray-900)] shadow-sm'
                  : 'text-[var(--color-gray-600)]'
              }`}
            >
              Annual
              <span className="ml-1 text-xs text-green-600">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const price = billingCycle === 'annual' ? plan.priceAnnual : plan.price;
            return (
              <div
                key={plan.name}
                className={`relative rounded-xl p-5 border ${
                  plan.popular
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-gray-200)]'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 left-4 bg-[var(--color-primary)] text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    Most Popular
                  </span>
                )}

                <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold">${price}</span>
                  <span className="text-[var(--color-gray-500)]">/seat/mo</span>
                </div>

                <div className="flex items-center gap-2 mb-4 text-sm text-[var(--color-primary)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {plan.credits}
                </div>

                <ul className="space-y-2 mb-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <svg
                        className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleUpgrade(plan.plan)}
                  disabled={isLoading}
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full"
                >
                  {isLoading ? 'Loading...' : `Upgrade to ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Credit Packs Option */}
        {reason === 'credits' && (
          <div className="mt-4 pt-4 border-t border-[var(--color-gray-200)]">
            <p className="text-sm text-[var(--color-gray-600)] text-center">
              Just need a quick top-up?{' '}
              <button
                onClick={() => {
                  onClose();
                  window.location.href = '/settings/billing?tab=credits';
                }}
                className="text-[var(--color-primary)] font-medium hover:underline"
              >
                Buy a credit pack
              </button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
