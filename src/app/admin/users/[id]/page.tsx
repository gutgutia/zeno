'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface UserDetail {
  profile: {
    id: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
    plan_type: string | null;
    stripe_customer_id: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  credits: {
    balance: number;
    lifetime_credits: number;
    lifetime_used: number;
  };
  dashboardCount: number;
  dashboards: Array<{
    id: string;
    title: string;
    slug: string;
    created_at: string;
    is_published: boolean;
  }>;
  override: {
    id: string;
    plan_type: string | null;
    max_dashboards: number | null;
    monthly_credits: number | null;
    price_override_cents: number | null;
    plan_expires_at: string | null;
    notes: string | null;
  } | null;
  transactions: Array<{
    id: string;
    amount: number;
    balance_after: number;
    transaction_type: string;
    description: string | null;
    created_at: string;
  }>;
  organizations: Array<{
    role: string;
    organization: {
      id: string;
      name: string;
      plan_type: string;
    };
  }>;
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Form states
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [overrideForm, setOverrideForm] = useState({
    plan_type: '',
    max_dashboards: '',
    monthly_credits: '',
    price_override_cents: '',
    expires_at: '',
    notes: '',
  });
  const [newPlanType, setNewPlanType] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [userId]);

  async function fetchUser() {
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user');
      const data = await response.json();
      setUser(data);
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCredits() {
    if (!creditAmount || !creditReason) {
      toast.error('Please enter amount and reason');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_credits',
          amount: parseInt(creditAmount),
          reason: creditReason,
        }),
      });

      if (!response.ok) throw new Error('Failed to add credits');

      toast.success('Credits added successfully');
      setShowCreditModal(false);
      setCreditAmount('');
      setCreditReason('');
      fetchUser();
    } catch (error) {
      console.error('Error adding credits:', error);
      toast.error('Failed to add credits');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetOverride() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_override',
          plan_type: overrideForm.plan_type || null,
          max_dashboards: overrideForm.max_dashboards ? parseInt(overrideForm.max_dashboards) : null,
          monthly_credits: overrideForm.monthly_credits ? parseInt(overrideForm.monthly_credits) : null,
          price_override_cents: overrideForm.price_override_cents ? parseInt(overrideForm.price_override_cents) : null,
          expires_at: overrideForm.expires_at || null,
          notes: overrideForm.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to set override');

      toast.success('Override set successfully');
      setShowOverrideModal(false);
      setOverrideForm({ plan_type: '', max_dashboards: '', monthly_credits: '', price_override_cents: '', expires_at: '', notes: '' });
      fetchUser();
    } catch (error) {
      console.error('Error setting override:', error);
      toast.error('Failed to set override');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveOverride() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_override' }),
      });

      if (!response.ok) throw new Error('Failed to remove override');

      toast.success('Override removed');
      fetchUser();
    } catch (error) {
      console.error('Error removing override:', error);
      toast.error('Failed to remove override');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePlan() {
    if (!newPlanType) {
      toast.error('Please select a plan');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_plan',
          plan_type: newPlanType,
        }),
      });

      if (!response.ok) throw new Error('Failed to update plan');

      toast.success('Plan updated successfully');
      setShowPlanModal(false);
      setNewPlanType('');
      fetchUser();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update plan');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="bg-white rounded-lg border p-6 animate-pulse">
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">User Not Found</h1>
        <Link href="/admin/users" className="text-[var(--color-primary)]">
          Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">User Details</h1>
      </div>

      {/* User Header Card */}
      <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-[var(--color-primary-light)] text-[var(--color-primary)] text-xl">
                {user.profile.name?.charAt(0).toUpperCase() || user.profile.email?.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-gray-900)]">
                {user.profile.name || 'No name'}
              </h2>
              <p className="text-[var(--color-gray-500)]">{user.profile.email || user.profile.id}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  user.override ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.profile.plan_type || 'free'}
                  {user.override && ' (override)'}
                </span>
                <span className="text-xs text-[var(--color-gray-400)]">
                  Joined {user.profile.created_at ? new Date(user.profile.created_at).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPlanModal(true)}>
              Change Plan
            </Button>
            <Button variant="outline" onClick={() => setShowOverrideModal(true)}>
              Set Override
            </Button>
            <Button onClick={() => setShowCreditModal(true)}>
              Add Credits
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-4">
          <p className="text-sm text-[var(--color-gray-500)]">Credit Balance</p>
          <p className="text-2xl font-bold text-[var(--color-gray-900)]">
            {user.credits.balance.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-4">
          <p className="text-sm text-[var(--color-gray-500)]">Lifetime Credits</p>
          <p className="text-2xl font-bold text-[var(--color-gray-900)]">
            {user.credits.lifetime_credits.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-4">
          <p className="text-sm text-[var(--color-gray-500)]">Credits Used</p>
          <p className="text-2xl font-bold text-[var(--color-gray-900)]">
            {user.credits.lifetime_used.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-4">
          <p className="text-sm text-[var(--color-gray-500)]">Dashboards</p>
          <p className="text-2xl font-bold text-[var(--color-gray-900)]">
            {user.dashboardCount}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Override Info */}
          {user.override && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-yellow-800">Active Override</h3>
                  <div className="mt-2 text-sm text-yellow-700 space-y-1">
                    {user.override.plan_type && <p>Plan: {user.override.plan_type}</p>}
                    {user.override.max_dashboards && <p>Max Dashboards: {user.override.max_dashboards}</p>}
                    {user.override.monthly_credits && <p>Monthly Credits: {user.override.monthly_credits}</p>}
                    {user.override.price_override_cents && (
                      <p>Fixed Price: ${(user.override.price_override_cents / 100).toFixed(2)}/month</p>
                    )}
                    {user.override.plan_expires_at && (
                      <p>Expires: {new Date(user.override.plan_expires_at).toLocaleDateString()}</p>
                    )}
                    {user.override.notes && <p>Notes: {user.override.notes}</p>}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveOverride}
                  disabled={saving}
                >
                  Remove Override
                </Button>
              </div>
            </div>
          )}

          {/* Organizations */}
          {user.organizations.length > 0 && (
            <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-4">
              <h3 className="font-medium text-[var(--color-gray-900)] mb-3">Organizations</h3>
              <div className="space-y-2">
                {user.organizations.map((membership, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-[var(--color-gray-50)] rounded">
                    <button
                      onClick={() => router.push(`/admin/organizations/${membership.organization?.id}`)}
                      className="text-[var(--color-primary)] hover:underline font-medium"
                    >
                      {membership.organization?.name || 'Unknown Org'}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-gray-500)]">
                        {membership.organization?.plan_type}
                      </span>
                      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                        {membership.role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions">
          <div className="bg-white rounded-lg border border-[var(--color-gray-200)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--color-gray-50)] border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Balance</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-gray-200)]">
                {user.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-gray-500)]">
                      No transactions
                    </td>
                  </tr>
                ) : (
                  user.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 text-sm text-[var(--color-gray-500)]">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="capitalize">{tx.transaction_type.replace(/_/g, ' ')}</span>
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-[var(--color-gray-900)]">
                        {tx.balance_after}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--color-gray-500)]">
                        {tx.description || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="dashboards">
          <div className="bg-white rounded-lg border border-[var(--color-gray-200)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--color-gray-50)] border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-gray-200)]">
                {user.dashboards.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[var(--color-gray-500)]">
                      No dashboards
                    </td>
                  </tr>
                ) : (
                  user.dashboards.map((dashboard) => (
                    <tr key={dashboard.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-gray-900)]">{dashboard.title}</p>
                        <p className="text-xs text-[var(--color-gray-500)]">{dashboard.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          dashboard.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {dashboard.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--color-gray-500)]">
                        {new Date(dashboard.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Credits Modal */}
      <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="Enter amount (positive to add, negative to deduct)"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-[var(--color-gray-500)] mt-1">
                Current balance: {user.credits.balance}
              </p>
            </div>
            <div>
              <Label>Reason (required)</Label>
              <Textarea
                placeholder="Why are you adjusting credits?"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCredits} disabled={saving}>
              {saving ? 'Adding...' : 'Add Credits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Override Modal */}
      <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Plan Override</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Plan Type (optional)</Label>
              <select
                value={overrideForm.plan_type}
                onChange={(e) => setOverrideForm({ ...overrideForm, plan_type: e.target.value })}
                className="mt-1 w-full rounded-md border border-[var(--color-gray-200)] px-3 py-2"
              >
                <option value="">No override</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <Label>Max Dashboards (optional)</Label>
              <Input
                type="number"
                placeholder="Leave empty for plan default"
                value={overrideForm.max_dashboards}
                onChange={(e) => setOverrideForm({ ...overrideForm, max_dashboards: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Monthly Credits (optional)</Label>
              <Input
                type="number"
                placeholder="Leave empty for plan default"
                value={overrideForm.monthly_credits}
                onChange={(e) => setOverrideForm({ ...overrideForm, monthly_credits: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Fixed Monthly Price in Cents (optional)</Label>
              <Input
                type="number"
                placeholder="e.g., 2900 for $29.00"
                value={overrideForm.price_override_cents}
                onChange={(e) => setOverrideForm({ ...overrideForm, price_override_cents: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Expires At (optional)</Label>
              <Input
                type="date"
                value={overrideForm.expires_at}
                onChange={(e) => setOverrideForm({ ...overrideForm, expires_at: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Internal notes about this override"
                value={overrideForm.notes}
                onChange={(e) => setOverrideForm({ ...overrideForm, notes: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetOverride} disabled={saving}>
              {saving ? 'Saving...' : 'Set Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Modal */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>New Plan</Label>
              <select
                value={newPlanType}
                onChange={(e) => setNewPlanType(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--color-gray-200)] px-3 py-2"
              >
                <option value="">Select a plan</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <p className="text-xs text-[var(--color-gray-500)] mt-1">
                Current plan: {user.profile.plan_type || 'free'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePlan} disabled={saving}>
              {saving ? 'Updating...' : 'Update Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
