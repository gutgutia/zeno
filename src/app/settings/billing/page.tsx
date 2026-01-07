'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';

interface CreditInfo {
  balance: number;
  lifetime_credits: number;
  lifetime_used: number;
  source: 'organization' | 'user';
  organization_id?: string;
  plan: string;
  limits: {
    dashboards: {
      current: number;
      limit: number | null;
      can_create: boolean;
    };
  };
  recent_transactions: Array<{
    id: string;
    amount: number;
    balance_after: number;
    transaction_type: string;
    description: string | null;
    created_at: string;
  }>;
}

const creditPacks = [
  { size: 'small', credits: 100, price: 6, perCredit: 0.06 },
  { size: 'medium', credits: 500, price: 25, perCredit: 0.05, savings: '17%' },
  { size: 'large', credits: 2000, price: 80, perCredit: 0.04, savings: '33%' },
];

const plans = [
  {
    name: 'Free',
    price: 0,
    credits: '100 one-time',
    features: ['Unlimited dashboards', 'Public sharing only', 'Zeno branding'],
    current: false,
    plan: 'free',
  },
  {
    name: 'Starter',
    price: 10,
    credits: '200/seat/mo',
    features: ['Unlimited dashboards', 'Private sharing', 'Custom subdomain', 'Email support'],
    plan: 'starter',
  },
  {
    name: 'Pro',
    price: 24,
    credits: '500/seat/mo',
    features: ['Remove Zeno branding', 'Custom domain', 'Custom branding', 'Google Sheets', 'Priority support'],
    popular: true,
    plan: 'pro',
  },
];

export default function BillingPage() {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchCredits();
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
      toast.error('Failed to load billing information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyCreditPack = async (size: string) => {
    setIsCheckoutLoading(size);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'credit_pack',
          pack_size: size,
          organization_id: creditInfo?.organization_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
      setIsCheckoutLoading(null);
    }
  };

  const handleUpgrade = async (plan: string) => {
    setIsCheckoutLoading(plan);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          plan,
          billing_cycle: 'annual',
          seats: 1,
          organization_id: creditInfo?.organization_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start checkout');
      setIsCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setIsCheckoutLoading('portal');
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: creditInfo?.organization_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open billing portal');
      setIsCheckoutLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      signup_bonus: 'Welcome Bonus',
      monthly_refill: 'Monthly Credits',
      credit_pack: 'Credit Pack',
      dashboard_create: 'Dashboard Created',
      dashboard_update: 'Dashboard Updated',
      dashboard_refresh: 'Data Refresh',
      manual_adjustment: 'Adjustment',
      refund: 'Refund',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[var(--color-gray-200)] rounded" />
          <div className="h-32 bg-[var(--color-gray-200)] rounded-xl" />
          <div className="h-64 bg-[var(--color-gray-200)] rounded-xl" />
        </div>
      </div>
    );
  }

  const currentPlan = creditInfo?.plan || 'free';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-[var(--color-gray-500)] mb-2">
          <Link href="/settings" className="hover:text-[var(--color-gray-700)]">
            Settings
          </Link>
          <span>/</span>
          <span>Billing</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Billing & Credits</h1>
      </div>

      {/* Credit Balance Card */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-1">Credit Balance</h2>
            <p className="text-sm text-[var(--color-gray-500)]">
              {creditInfo?.source === 'organization' ? 'Shared with your organization' : 'Personal credits'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[var(--color-gray-900)]">
              {creditInfo?.balance || 0}
            </div>
            <div className="text-sm text-[var(--color-gray-500)]">credits</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-[var(--color-gray-100)]">
          <div>
            <div className="text-sm text-[var(--color-gray-500)]">Lifetime Received</div>
            <div className="text-lg font-medium">{creditInfo?.lifetime_credits || 0}</div>
          </div>
          <div>
            <div className="text-sm text-[var(--color-gray-500)]">Lifetime Used</div>
            <div className="text-lg font-medium">{creditInfo?.lifetime_used || 0}</div>
          </div>
        </div>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] overflow-hidden mb-8">
        {/* Plan Header */}
        <div className={`p-6 ${currentPlan !== 'free' ? 'bg-gradient-to-r from-[var(--color-primary)]/5 to-[var(--color-primary)]/10' : ''}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold text-[var(--color-gray-900)] capitalize">
                  {currentPlan} Plan
                </span>
                {currentPlan === 'free' ? (
                  <span className="px-2.5 py-1 text-xs font-medium bg-[var(--color-gray-100)] text-[var(--color-gray-600)] rounded-full">
                    Free Tier
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    Active
                  </span>
                )}
              </div>
              {currentPlan === 'free' ? (
                <p className="text-sm text-[var(--color-gray-600)]">
                  Upgrade to get more credits monthly and unlock premium features.
                </p>
              ) : (
                <p className="text-sm text-[var(--color-gray-600)]">
                  {currentPlan === 'starter' ? '200' : '500'} credits per month • Renews monthly
                </p>
              )}
            </div>
            {currentPlan !== 'free' && (
              <Button
                onClick={handleManageBilling}
                disabled={isCheckoutLoading === 'portal'}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {isCheckoutLoading === 'portal' ? 'Loading...' : 'Manage Subscription'}
              </Button>
            )}
          </div>
        </div>

        {/* Subscription Details for Paid Plans */}
        {currentPlan !== 'free' && (
          <div className="px-6 py-4 bg-[var(--color-gray-50)] border-t border-[var(--color-gray-100)]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-gray-600)]">
                Manage your subscription, update payment methods, view invoices, or cancel anytime.
              </span>
            </div>
          </div>
        )}

        {/* Dashboard Count */}
        <div className="px-6 py-4 border-t border-[var(--color-gray-100)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--color-gray-600)]">
              <span className="font-medium text-[var(--color-gray-900)]">{creditInfo?.limits?.dashboards?.current || 0}</span>
              <span> dashboards created</span>
            </div>
            <span className="text-xs text-[var(--color-gray-500)]">Unlimited</span>
          </div>
        </div>
      </div>

      {/* Credit Packs */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-8">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Buy Credit Packs</h2>
        <p className="text-sm text-[var(--color-gray-500)] mb-6">
          Need more credits? Purchase a pack anytime.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {creditPacks.map((pack) => (
            <div
              key={pack.size}
              className="relative border border-[var(--color-gray-200)] rounded-xl p-4 hover:border-[var(--color-primary)] transition-colors"
            >
              {pack.savings && (
                <span className="absolute -top-2 right-3 bg-green-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  Save {pack.savings}
                </span>
              )}
              <div className="text-2xl font-bold text-[var(--color-gray-900)] mb-1">
                {pack.credits.toLocaleString()}
              </div>
              <div className="text-sm text-[var(--color-gray-500)] mb-3">credits</div>
              <div className="text-lg font-semibold text-[var(--color-primary)] mb-1">
                ${pack.price}
              </div>
              <div className="text-xs text-[var(--color-gray-400)] mb-4">
                ${pack.perCredit.toFixed(2)}/credit
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleBuyCreditPack(pack.size)}
                disabled={isCheckoutLoading === pack.size}
              >
                {isCheckoutLoading === pack.size ? 'Loading...' : 'Buy Now'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Plans (only show if on free) */}
      {currentPlan === 'free' && (
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Upgrade Your Plan</h2>
          <p className="text-sm text-[var(--color-gray-500)] mb-6">
            Get more credits monthly, unlock premium features, and remove limits.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {plans.filter(p => p.plan !== 'free').map((plan) => (
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
                  <span className="text-2xl font-bold">${plan.price}</span>
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
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleUpgrade(plan.plan)}
                  disabled={isCheckoutLoading === plan.plan}
                  variant={plan.popular ? 'default' : 'outline'}
                  className="w-full"
                >
                  {isCheckoutLoading === plan.plan ? 'Loading...' : `Upgrade to ${plan.name}`}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Recent Transactions</h2>

        {creditInfo?.recent_transactions && creditInfo.recent_transactions.length > 0 ? (
          <div className="space-y-3">
            {creditInfo.recent_transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3 border-b border-[var(--color-gray-100)] last:border-0"
              >
                <div>
                  <div className="font-medium text-[var(--color-gray-900)]">
                    {getTransactionLabel(tx.transaction_type)}
                  </div>
                  <div className="text-sm text-[var(--color-gray-500)]">
                    {tx.description || formatDate(tx.created_at)}
                  </div>
                </div>
                <div className={`font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-[var(--color-gray-900)]'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-gray-500)]">No transactions yet</p>
        )}
      </div>
    </div>
  );
}
