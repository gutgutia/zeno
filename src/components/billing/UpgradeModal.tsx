'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
  onCreditsAdded?: () => void; // Called when credits are successfully added
}

const creditPacks = [
  { size: 'small', credits: 100, price: 10, perCredit: 0.10 },
  { size: 'medium', credits: 500, price: 45, perCredit: 0.09, savings: '10%', popular: true },
  { size: 'large', credits: 2000, price: 160, perCredit: 0.08, savings: '20%' },
];

const plans = [
  {
    name: 'Starter',
    price: 10,
    priceAnnual: 8,
    credits: '100/seat/mo',
    features: ['100 credits/month', 'Private sharing', 'Custom subdomain', 'Email support'],
    plan: 'starter',
  },
  {
    name: 'Pro',
    price: 25,
    priceAnnual: 20,
    credits: '250/seat/mo',
    features: [
      '250 credits/month',
      'Everything in Starter',
      'Remove Zeno branding',
      'Custom domain',
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
  onCreditsAdded,
}: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [showPlans, setShowPlans] = useState(false);
  const searchParams = useSearchParams();

  // Check for successful credit purchase on mount/when searchParams change
  useEffect(() => {
    const creditsPurchased = searchParams.get('credits_purchased');
    if (creditsPurchased === 'true' && isOpen) {
      toast.success('Credits added successfully!');
      // Clear URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('credits_purchased');
      window.history.replaceState({}, '', url.toString());
      // Notify parent that credits were added
      if (onCreditsAdded) {
        onCreditsAdded();
      }
      onClose();
    }
  }, [searchParams, isOpen, onClose, onCreditsAdded]);

  const handleBuyCreditPack = async (size: string) => {
    setIsLoading(size);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'credit_pack',
          pack_size: size,
          return_url: window.location.pathname, // Return to current page
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
      setIsLoading(null);
    }
  };

  const handleUpgrade = async (plan: string) => {
    setIsLoading(plan);
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
      setIsLoading(null);
    }
  };

  const getTitle = () => {
    if (reason === 'credits') {
      return 'Need More Credits';
    }
    switch (reason) {
      case 'dashboards':
        return 'Dashboard Limit Reached';
      case 'feature':
        return `Unlock ${featureName || 'This Feature'}`;
      default:
        return 'Upgrade Your Plan';
    }
  };

  const getDescription = () => {
    if (reason === 'credits') {
      return 'You don\'t have enough credits to complete this action. Purchase a credit pack to continue.';
    }
    switch (reason) {
      case 'dashboards':
        return 'You\'ve reached the free plan limit of 3 dashboards. Upgrade to create unlimited dashboards.';
      case 'feature':
        return `${featureName || 'This feature'} is available on paid plans. Upgrade to unlock it.`;
      default:
        return 'Upgrade to unlock more features and get more credits.';
    }
  };

  // For credits reason, show credit packs by default
  if (reason === 'credits' && !showPlans) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{getTitle()}</DialogTitle>
            <DialogDescription>{getDescription()}</DialogDescription>
          </DialogHeader>

          {/* Credit Packs */}
          <div className="space-y-3 mt-2">
            {creditPacks.map((pack) => (
              <div
                key={pack.size}
                className={`relative flex items-center justify-between p-4 border rounded-xl transition-colors ${
                  pack.popular
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
                }`}
              >
                {pack.savings && (
                  <span className="absolute -top-2 left-3 bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    Save {pack.savings}
                  </span>
                )}
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-[var(--color-gray-900)]">
                        {pack.credits.toLocaleString()}
                      </span>
                      <span className="text-sm text-[var(--color-gray-500)]">credits</span>
                    </div>
                    <div className="text-sm text-[var(--color-gray-400)]">
                      ${pack.perCredit.toFixed(2)}/credit
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => handleBuyCreditPack(pack.size)}
                  disabled={isLoading === pack.size}
                  variant={pack.popular ? 'default' : 'outline'}
                  className="min-w-[100px]"
                >
                  {isLoading === pack.size ? 'Loading...' : `$${pack.price}`}
                </Button>
              </div>
            ))}
          </div>

          {/* Subscribe Option */}
          <div className="mt-4 pt-4 border-t border-[var(--color-gray-200)]">
            <p className="text-sm text-[var(--color-gray-600)] text-center">
              Need credits regularly?{' '}
              <button
                onClick={() => setShowPlans(true)}
                className="text-[var(--color-primary)] font-medium hover:underline"
              >
                Subscribe for monthly credits
              </button>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show subscription plans (for non-credits reasons or when user clicks "Subscribe")
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {reason === 'credits' ? 'Subscribe for Monthly Credits' : getTitle()}
          </DialogTitle>
          <DialogDescription>
            {reason === 'credits'
              ? 'Get credits every month and unlock premium features.'
              : getDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Back to Credit Packs (if coming from credits view) */}
        {reason === 'credits' && showPlans && (
          <button
            onClick={() => setShowPlans(false)}
            className="flex items-center gap-1 text-sm text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)] mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to credit packs
          </button>
        )}

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
                  disabled={isLoading === plan.plan}
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full"
                >
                  {isLoading === plan.plan ? 'Loading...' : `Upgrade to ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
