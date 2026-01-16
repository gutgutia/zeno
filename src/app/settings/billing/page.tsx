'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';

interface CreditInfo {
  balance: number;
  lifetime_credits: number;
  lifetime_used: number;
  source: 'organization' | 'user';
  organization_id?: string;
  plan: string;
  subscription_ends_at?: string | null;
  billing_cycle?: 'monthly' | 'annual' | null;
  last_refill_at?: string | null;
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
  { size: 'small', credits: 100, price: 10, perCredit: 0.10 },
  { size: 'medium', credits: 500, price: 45, perCredit: 0.09, savings: '10%' },
  { size: 'large', credits: 2000, price: 160, perCredit: 0.08, savings: '20%' },
];

const plans = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    credits: '100 one-time',
    features: ['Unlimited dashboards', 'Public sharing only', 'Zeno branding'],
    current: false,
    plan: 'free',
  },
  {
    name: 'Starter',
    monthlyPrice: 10,
    annualPrice: 8,
    credits: '100/seat/mo',
    features: ['Unlimited dashboards', 'Private sharing', 'Custom subdomain', 'Email support'],
    plan: 'starter',
  },
  {
    name: 'Pro',
    monthlyPrice: 25,
    annualPrice: 20,
    credits: '250/seat/mo',
    features: ['Remove Zeno branding', 'Custom domain', 'Custom branding', 'Google Sheets', 'Priority support'],
    popular: true,
    plan: 'pro',
  },
];

interface SeatInfo {
  seats_purchased: number;
  seats_used: number;
  seats_pending: number;
  seats_available: number;
  plan_type: string;
  billing_cycle: 'monthly' | 'annual';
  has_subscription: boolean;
  subscription_ends_at: string | null;
  current_period_end: string | null;
  current_period_start: string | null;
  days_remaining: number | null;
  total_days_in_period: number | null;
  credits_per_seat: number;
  price_per_seat: number;
  price_per_seat_monthly: number;
  price_per_seat_annual: number;
}

interface Invoice {
  id: string;
  number: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string | null;
  created: number;
  due_date: number | null;
  period_start: number | null;
  period_end: number | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  description: string | null;
}

function BillingContent() {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [isSeatDialogOpen, setIsSeatDialogOpen] = useState(false);
  const [newSeatCount, setNewSeatCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();

  const fetchCredits = useCallback(async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCreditInfo(data);
        // Fetch seat info and invoices if we have an org
        if (data.organization_id) {
          fetchSeatInfo(data.organization_id);
          fetchInvoices(data.organization_id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
      toast.error('Failed to load billing information');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSeatInfo = async (orgId: string) => {
    try {
      const response = await fetch(`/api/billing/seats?organization_id=${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setSeatInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch seat info:', error);
    }
  };

  const fetchInvoices = async (orgId: string) => {
    try {
      const response = await fetch(`/api/billing/invoices?organization_id=${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }
  };

  useEffect(() => {
    fetchCredits();

    // Show toast based on URL params (returning from Stripe)
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const fromPortal = searchParams.get('from_portal');

    if (success === 'true') {
      toast.success('Payment successful! Your account has been updated.');
      // Clear URL params
      window.history.replaceState({}, '', '/settings/billing');
    } else if (canceled === 'true') {
      toast.info('Payment was canceled.');
      window.history.replaceState({}, '', '/settings/billing');
    } else if (fromPortal === 'true') {
      // Returning from portal - just refresh data silently
      toast.success('Billing settings updated.');
      window.history.replaceState({}, '', '/settings/billing');
    }

    // Refresh when returning to the page (e.g., from Stripe portal)
    const handleFocus = () => {
      fetchCredits();
    };

    // Listen for credits-updated event from other components
    const handleCreditsUpdated = () => {
      fetchCredits();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('credits-updated', handleCreditsUpdated);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('credits-updated', handleCreditsUpdated);
    };
  }, [fetchCredits, searchParams]);

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
          billing_cycle: billingCycle,
          seats: 1,
          organization_id: creditInfo?.organization_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // If subscription was updated inline (no redirect needed)
      if (data.success) {
        toast.success(data.message || 'Subscription updated successfully');
        // Refresh the page to show updated plan
        await fetchCredits();
        // Notify other components (like navbar) to refresh credits
        window.dispatchEvent(new CustomEvent('credits-updated'));
        setIsCheckoutLoading(null);
        return;
      }

      // Otherwise redirect to Stripe checkout
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

  const handleUpdateSeats = async () => {
    if (!creditInfo?.organization_id || !seatInfo) return;
    if (newSeatCount === seatInfo.seats_purchased) return; // No change

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/billing/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: creditInfo.organization_id,
          seats: newSeatCount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update seats');
      }

      setIsSeatDialogOpen(false);
      fetchSeatInfo(creditInfo.organization_id);
      if (newSeatCount > seatInfo.seats_purchased) {
        fetchCredits();
        window.dispatchEvent(new CustomEvent('credits-updated'));
      }
      toast.success(data.message || `Updated to ${newSeatCount} seat(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update seats');
    } finally {
      setIsSubmitting(false);
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
                ) : creditInfo?.subscription_ends_at ? (
                  <span className="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                    Canceling
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
              ) : creditInfo?.subscription_ends_at ? (
                <p className="text-sm text-[var(--color-gray-600)]">
                  Your plan is active until {new Date(creditInfo.subscription_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              ) : (
                <p className="text-sm text-[var(--color-gray-600)]">
                  {currentPlan === 'starter' ? '100' : '250'} credits per month • Renews {creditInfo?.billing_cycle === 'annual' ? 'annually' : 'monthly'}
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

        {/* Cancellation Notice */}
        {currentPlan !== 'free' && creditInfo?.subscription_ends_at && (
          <div className="px-6 py-4 bg-amber-50 border-t border-amber-100">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Your subscription is scheduled to cancel
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  You&apos;ll keep access to {currentPlan === 'starter' ? 'Starter' : 'Pro'} features until {new Date(creditInfo.subscription_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
                  After that, you&apos;ll be downgraded to the Free plan. Your credits will remain in your account.
                </p>
                <p className="text-sm text-amber-700 mt-2">
                  Changed your mind? Click &quot;Manage Subscription&quot; to reactivate.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Details for Paid Plans */}
        {currentPlan !== 'free' && !creditInfo?.subscription_ends_at && (
          <div className="px-6 py-4 bg-[var(--color-gray-50)] border-t border-[var(--color-gray-100)]">
            <div className="flex items-center gap-6 text-sm">
              {/* Next Renewal Date */}
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[var(--color-gray-600)]">
                  Next renewal: {(() => {
                    // Calculate next renewal based on billing cycle and last refill
                    if (creditInfo?.last_refill_at) {
                      const lastRefill = new Date(creditInfo.last_refill_at);
                      const nextRenewal = new Date(lastRefill);
                      if (creditInfo.billing_cycle === 'annual') {
                        nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
                      } else {
                        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
                      }
                      return nextRenewal.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }
                    return 'N/A';
                  })()}
                </span>
              </div>
              {/* Next Credit Refill */}
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-[var(--color-gray-600)]">
                  Next credit refill: {(() => {
                    // Credits refill monthly for all plans
                    if (creditInfo?.last_refill_at) {
                      const lastRefill = new Date(creditInfo.last_refill_at);
                      const nextRefill = new Date(lastRefill);
                      nextRefill.setMonth(nextRefill.getMonth() + 1);
                      return nextRefill.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }
                    return 'N/A';
                  })()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Seats Section - Show for paid plans */}
      {seatInfo && currentPlan !== 'free' && (
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-gray-900)]">Team Seats</h2>
              <p className="text-sm text-[var(--color-gray-500)]">
                {seatInfo.credits_per_seat} credits per seat per month
              </p>
            </div>
            {seatInfo.has_subscription && !creditInfo?.subscription_ends_at && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewSeatCount(seatInfo.seats_purchased);
                  setIsSeatDialogOpen(true);
                }}
              >
                Manage Seats
              </Button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-[var(--color-gray-50)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-[var(--color-gray-900)]">
                {seatInfo.seats_purchased}
              </div>
              <div className="text-sm text-[var(--color-gray-500)]">Total Seats</div>
            </div>
            <div className="bg-[var(--color-gray-50)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-[var(--color-gray-900)]">
                {seatInfo.seats_used}
              </div>
              <div className="text-sm text-[var(--color-gray-500)]">In Use</div>
            </div>
            <div className="bg-[var(--color-gray-50)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">
                {seatInfo.seats_pending}
              </div>
              <div className="text-sm text-[var(--color-gray-500)]">Pending</div>
            </div>
            <div className="bg-[var(--color-gray-50)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {seatInfo.seats_available}
              </div>
              <div className="text-sm text-[var(--color-gray-500)]">Available</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--color-gray-100)] flex items-center justify-between text-sm">
            {seatInfo.has_subscription ? (
              <span className="text-[var(--color-gray-600)]">
                Cost per seat: ${seatInfo.price_per_seat}/{seatInfo.billing_cycle === 'annual' ? 'mo (billed annually)' : 'mo'}
              </span>
            ) : (
              <span className="text-[var(--color-gray-500)]">
                Plan managed by admin
              </span>
            )}
            <Link href="/settings/team" className="text-[var(--color-primary)] hover:underline">
              Manage Team Members →
            </Link>
          </div>
        </div>
      )}

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

      {/* Upgrade Plans (show if can upgrade to a higher plan) */}
      {(() => {
        const planOrder = ['free', 'starter', 'pro'];
        const currentIndex = planOrder.indexOf(currentPlan);
        const availablePlans = plans.filter(p => {
          const planIndex = planOrder.indexOf(p.plan);
          return planIndex > currentIndex;
        });

        if (availablePlans.length === 0) return null;

        return (
          <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-8">
            <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">
              {currentPlan === 'free' ? 'Upgrade Your Plan' : 'Upgrade to Pro'}
            </h2>
            <p className="text-sm text-[var(--color-gray-500)] mb-4">
              {currentPlan === 'free'
                ? 'Get more credits monthly, unlock premium features, and remove limits.'
                : 'Get 250 credits/seat/month, remove Zeno branding, and unlock premium features.'}
            </p>

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

            <div className={`grid gap-4 ${availablePlans.length > 1 ? 'md:grid-cols-2' : 'max-w-md mx-auto'}`}>
              {availablePlans.map((plan) => {
                const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
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
                        {currentPlan === 'starter' ? 'Recommended' : 'Most Popular'}
                      </span>
                    )}

                    <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-2xl font-bold">${price}</span>
                      <span className="text-[var(--color-gray-500)]">/seat/mo</span>
                    </div>
                    {billingCycle === 'annual' && (
                      <p className="text-xs text-[var(--color-gray-400)] mb-2">
                        Billed annually (${price * 12}/seat/year)
                      </p>
                    )}

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
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Invoices - Show for paid plans */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Invoices</h2>

          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between py-3 border-b border-[var(--color-gray-100)] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[var(--color-gray-100)] rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--color-gray-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-[var(--color-gray-900)]">
                      {invoice.number || `Invoice ${invoice.id.slice(-8)}`}
                    </div>
                    <div className="text-sm text-[var(--color-gray-500)]">
                      {new Date(invoice.created * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-medium text-[var(--color-gray-900)]">
                      ${(invoice.amount_paid / 100).toFixed(2)}
                    </div>
                    <div className={`text-xs font-medium ${
                      invoice.status === 'paid' ? 'text-green-600' :
                      invoice.status === 'open' ? 'text-amber-600' :
                      'text-[var(--color-gray-500)]'
                    }`}>
                      {invoice.status === 'paid' ? 'Paid' :
                       invoice.status === 'open' ? 'Open' :
                       invoice.status === 'draft' ? 'Draft' :
                       invoice.status || 'Unknown'}
                    </div>
                  </div>
                  {invoice.invoice_pdf && (
                    <a
                      href={invoice.invoice_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-[var(--color-gray-400)] hover:text-[var(--color-gray-600)] transition-colors"
                      title="Download PDF"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Credit Transactions</h2>

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

      {/* Manage Seats Dialog */}
      <Dialog open={isSeatDialogOpen} onOpenChange={setIsSeatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Team Seats</DialogTitle>
            <DialogDescription>
              Adjust your seat count. You have {seatInfo?.seats_used || 0} seat{(seatInfo?.seats_used || 0) !== 1 ? 's' : ''} in use.
            </DialogDescription>
          </DialogHeader>

          {seatInfo && (
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-gray-700)] mb-3">
                  Total seats
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setNewSeatCount(Math.max(seatInfo.seats_used + seatInfo.seats_pending, newSeatCount - 1))}
                    disabled={newSeatCount <= seatInfo.seats_used + seatInfo.seats_pending}
                    className="w-12 h-12 rounded-lg border border-[var(--color-gray-200)] flex items-center justify-center hover:bg-[var(--color-gray-50)] disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    <div className="text-4xl font-bold text-[var(--color-gray-900)]">
                      {newSeatCount}
                    </div>
                  </div>
                  <button
                    onClick={() => setNewSeatCount(newSeatCount + 1)}
                    className="w-12 h-12 rounded-lg border border-[var(--color-gray-200)] flex items-center justify-center hover:bg-[var(--color-gray-50)] text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Show summary only when there's a change */}
              {newSeatCount !== seatInfo.seats_purchased && (
                <>
                  {newSeatCount > seatInfo.seats_purchased ? (
                    // Adding seats
                    <div className="bg-[var(--color-primary)]/5 rounded-lg p-4 border border-[var(--color-primary)]/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--color-gray-600)]">Adding</span>
                        <span className="font-medium text-[var(--color-gray-900)]">
                          {newSeatCount - seatInfo.seats_purchased} seat{newSeatCount - seatInfo.seats_purchased > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--color-gray-600)]">
                          Additional {seatInfo.billing_cycle === 'annual' ? 'annual' : 'monthly'} cost
                        </span>
                        <span className="font-medium text-[var(--color-gray-900)]">
                          {seatInfo.billing_cycle === 'annual'
                            ? `+$${(newSeatCount - seatInfo.seats_purchased) * seatInfo.price_per_seat_annual}/year`
                            : `+$${(newSeatCount - seatInfo.seats_purchased) * seatInfo.price_per_seat}/mo`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--color-gray-600)]">Additional credits/mo</span>
                        <span className="font-medium text-green-600">
                          +{(newSeatCount - seatInfo.seats_purchased) * seatInfo.credits_per_seat}
                        </span>
                      </div>
                      {/* Prorated amount charged today */}
                      {seatInfo.days_remaining !== null && seatInfo.total_days_in_period !== null && seatInfo.total_days_in_period > 0 && (
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-[var(--color-primary)]/10">
                          <span className="text-[var(--color-gray-600)]">Charged today (prorated)</span>
                          <span className="font-semibold text-[var(--color-gray-900)]">
                            ${(
                              ((newSeatCount - seatInfo.seats_purchased) *
                                (seatInfo.billing_cycle === 'annual' ? seatInfo.price_per_seat_annual : seatInfo.price_per_seat) *
                                seatInfo.days_remaining) /
                              seatInfo.total_days_in_period
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Removing seats
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--color-gray-600)]">Removing</span>
                        <span className="font-medium text-[var(--color-gray-900)]">
                          {seatInfo.seats_purchased - newSeatCount} seat{seatInfo.seats_purchased - newSeatCount > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[var(--color-gray-600)]">
                          {seatInfo.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} savings
                        </span>
                        <span className="font-medium text-green-600">
                          {seatInfo.billing_cycle === 'annual'
                            ? `$${(seatInfo.seats_purchased - newSeatCount) * seatInfo.price_per_seat_annual}/year`
                            : `$${(seatInfo.seats_purchased - newSeatCount) * seatInfo.price_per_seat}/mo`}
                        </span>
                      </div>
                      {seatInfo.current_period_end && (
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-amber-200">
                          <span className="text-[var(--color-gray-600)]">Takes effect on</span>
                          <span className="font-semibold text-[var(--color-gray-900)]">
                            {new Date(seatInfo.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-amber-700 mt-3">
                        No refund will be issued. You&apos;ll keep all {seatInfo.seats_purchased} seats until then.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSeatDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSeats}
              disabled={isSubmitting || !seatInfo || newSeatCount === seatInfo.seats_purchased}
              variant={newSeatCount < (seatInfo?.seats_purchased || 0) ? 'destructive' : 'default'}
            >
              {isSubmitting ? 'Updating...' : newSeatCount === seatInfo?.seats_purchased ? 'No Change' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[var(--color-gray-200)] rounded" />
          <div className="h-32 bg-[var(--color-gray-200)] rounded-xl" />
          <div className="h-64 bg-[var(--color-gray-200)] rounded-xl" />
        </div>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
