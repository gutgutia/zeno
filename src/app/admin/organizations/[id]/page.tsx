'use client';

import { useEffect, useState, use } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface OrgMember {
  id: string;
  user_id: string;
  email: string | null;
  role: string;
  invited_at: string;
  accepted_at: string | null;
  profile: {
    id: string;
    name: string | null;
    avatar_url: string | null;
    plan_type: string | null;
  } | null;
}

interface OrgDetail {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan_type: string;
    billing_cycle: string;
    seats_purchased: number;
    subdomain: string | null;
    custom_domain: string | null;
    billing_email: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    branding: Record<string, unknown> | null;
    created_at: string;
    created_by: string;
  };
  members: OrgMember[];
  invitations: Array<{
    id: string;
    email: string;
    role: string;
    expires_at: string;
  }>;
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
}

export default function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orgId } = use(params);
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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
  const [planForm, setPlanForm] = useState({
    plan_type: '',
    seats_purchased: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    subdomain: '',
    custom_domain: '',
    billing_email: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOrg();
  }, [orgId]);

  async function fetchOrg() {
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`);
      if (!response.ok) throw new Error('Failed to fetch organization');
      const data = await response.json();
      setOrg(data);
      // Initialize edit form
      setEditForm({
        name: data.organization.name || '',
        subdomain: data.organization.subdomain || '',
        custom_domain: data.organization.custom_domain || '',
        billing_email: data.organization.billing_email || '',
      });
      setPlanForm({
        plan_type: data.organization.plan_type || '',
        seats_purchased: data.organization.seats_purchased?.toString() || '',
      });
    } catch (error) {
      console.error('Error fetching organization:', error);
      toast.error('Failed to load organization');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string, data: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });

      if (!response.ok) throw new Error('Failed to perform action');

      toast.success('Action completed successfully');
      fetchOrg();
      return true;
    } catch (error) {
      console.error('Error performing action:', error);
      toast.error('Failed to perform action');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCredits() {
    if (!creditAmount || !creditReason) {
      toast.error('Please enter amount and reason');
      return;
    }
    const success = await handleAction('add_credits', {
      amount: parseInt(creditAmount),
      reason: creditReason,
    });
    if (success) {
      setShowCreditModal(false);
      setCreditAmount('');
      setCreditReason('');
    }
  }

  async function handleSetOverride() {
    const success = await handleAction('set_override', {
      plan_type: overrideForm.plan_type || null,
      max_dashboards: overrideForm.max_dashboards ? parseInt(overrideForm.max_dashboards) : null,
      monthly_credits: overrideForm.monthly_credits ? parseInt(overrideForm.monthly_credits) : null,
      price_override_cents: overrideForm.price_override_cents ? parseInt(overrideForm.price_override_cents) : null,
      expires_at: overrideForm.expires_at || null,
      notes: overrideForm.notes || null,
    });
    if (success) {
      setShowOverrideModal(false);
      setOverrideForm({ plan_type: '', max_dashboards: '', monthly_credits: '', price_override_cents: '', expires_at: '', notes: '' });
    }
  }

  async function handleRemoveOverride() {
    await handleAction('remove_override', {});
  }

  async function handleUpdatePlan() {
    const success = await handleAction('update_plan', {
      plan_type: planForm.plan_type,
      seats_purchased: planForm.seats_purchased ? parseInt(planForm.seats_purchased) : undefined,
    });
    if (success) {
      setShowPlanModal(false);
    }
  }

  async function handleUpdateOrg() {
    const success = await handleAction('update_org', editForm);
    if (success) {
      setShowEditModal(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this member?')) return;
    await handleAction('remove_member', { member_id: memberId });
  }

  async function handleUpdateMemberRole(memberId: string, role: string) {
    await handleAction('update_member_role', { member_id: memberId, role });
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

  if (!org) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Organization Not Found</h1>
        <Link href="/admin/organizations" className="text-[var(--color-primary)]">
          Back to Organizations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/organizations"
          className="text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Organization Details</h1>
      </div>

      {/* Org Header Card */}
      <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-gray-900)]">
              {org.organization.name}
            </h2>
            <p className="text-[var(--color-gray-500)]">{org.organization.slug}</p>
            {(org.organization.subdomain || org.organization.custom_domain) && (
              <p className="text-sm text-[var(--color-primary)] mt-1">
                {org.organization.custom_domain || `${org.organization.subdomain}.zeno.app`}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                org.override ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {org.organization.plan_type}
                {org.override && ' (override)'}
              </span>
              <span className="text-xs text-[var(--color-gray-400)]">
                {org.organization.seats_purchased} seats • {org.organization.billing_cycle}
              </span>
              {org.organization.stripe_subscription_id && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Active Subscription
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditModal(true)}>
              Edit
            </Button>
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
            {org.credits.balance.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-4">
          <p className="text-sm text-[var(--color-gray-500)]">Lifetime Credits</p>
          <p className="text-2xl font-bold text-[var(--color-gray-900)]">
            {org.credits.lifetime_credits.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-4">
          <p className="text-sm text-[var(--color-gray-500)]">Members</p>
          <p className="text-2xl font-bold text-[var(--color-gray-900)]">
            {org.members.length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-4">
          <p className="text-sm text-[var(--color-gray-500)]">Dashboards</p>
          <p className="text-2xl font-bold text-[var(--color-gray-900)]">
            {org.dashboardCount}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {/* Override Info */}
          {org.override && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-yellow-800">Active Override</h3>
                  <div className="mt-2 text-sm text-yellow-700 space-y-1">
                    {org.override.plan_type && <p>Plan: {org.override.plan_type}</p>}
                    {org.override.max_dashboards && <p>Max Dashboards: {org.override.max_dashboards}</p>}
                    {org.override.monthly_credits && <p>Monthly Credits: {org.override.monthly_credits}</p>}
                    {org.override.price_override_cents && (
                      <p>Fixed Price: ${(org.override.price_override_cents / 100).toFixed(2)}/month</p>
                    )}
                    {org.override.plan_expires_at && (
                      <p>Expires: {new Date(org.override.plan_expires_at).toLocaleDateString()}</p>
                    )}
                    {org.override.notes && <p>Notes: {org.override.notes}</p>}
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

          {/* Members Table */}
          <div className="bg-white rounded-lg border border-[var(--color-gray-200)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--color-gray-50)] border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Joined</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-gray-200)]">
                {org.members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-gray-500)]">
                      No members
                    </td>
                  </tr>
                ) : (
                  org.members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-[var(--color-primary-light)] text-[var(--color-primary)] text-sm">
                              {member.profile?.name?.charAt(0).toUpperCase() || member.email?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-[var(--color-gray-900)]">
                              {member.profile?.name || 'No name'}
                            </p>
                            <p className="text-sm text-[var(--color-gray-500)]">
                              {member.email || member.user_id.slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${
                              member.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                              member.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {member.role}
                              <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleUpdateMemberRole(member.id, 'owner')}>
                              Owner
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateMemberRole(member.id, 'admin')}>
                              Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateMemberRole(member.id, 'member')}>
                              Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--color-gray-500)]">
                        {member.accepted_at
                          ? new Date(member.accepted_at).toLocaleDateString()
                          : 'Pending'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/users/${member.user_id}`}
                            className="text-sm text-[var(--color-primary)] hover:underline"
                          >
                            View User
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pending Invitations */}
          {org.invitations.length > 0 && (
            <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-4">
              <h3 className="font-medium text-[var(--color-gray-900)] mb-3">Pending Invitations</h3>
              <div className="space-y-2">
                {org.invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-2 bg-[var(--color-gray-50)] rounded">
                    <div>
                      <span className="text-sm text-[var(--color-gray-900)]">{inv.email}</span>
                      <span className="text-xs text-[var(--color-gray-500)] ml-2">({inv.role})</span>
                    </div>
                    <span className="text-xs text-[var(--color-gray-500)]">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
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
                {org.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-gray-500)]">
                      No transactions
                    </td>
                  </tr>
                ) : (
                  org.transactions.map((tx) => (
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
                {org.dashboards.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[var(--color-gray-500)]">
                      No dashboards
                    </td>
                  </tr>
                ) : (
                  org.dashboards.map((dashboard) => (
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

        <TabsContent value="settings">
          <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6 space-y-4">
            <h3 className="font-medium text-[var(--color-gray-900)]">Organization Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--color-gray-500)]">ID</p>
                <p className="font-mono text-[var(--color-gray-900)]">{org.organization.id}</p>
              </div>
              <div>
                <p className="text-[var(--color-gray-500)]">Slug</p>
                <p className="text-[var(--color-gray-900)]">{org.organization.slug}</p>
              </div>
              <div>
                <p className="text-[var(--color-gray-500)]">Subdomain</p>
                <p className="text-[var(--color-gray-900)]">{org.organization.subdomain || '-'}</p>
              </div>
              <div>
                <p className="text-[var(--color-gray-500)]">Custom Domain</p>
                <p className="text-[var(--color-gray-900)]">{org.organization.custom_domain || '-'}</p>
              </div>
              <div>
                <p className="text-[var(--color-gray-500)]">Billing Email</p>
                <p className="text-[var(--color-gray-900)]">{org.organization.billing_email || '-'}</p>
              </div>
              <div>
                <p className="text-[var(--color-gray-500)]">Stripe Customer</p>
                <p className="font-mono text-xs text-[var(--color-gray-900)]">{org.organization.stripe_customer_id || '-'}</p>
              </div>
              <div>
                <p className="text-[var(--color-gray-500)]">Stripe Subscription</p>
                <p className="font-mono text-xs text-[var(--color-gray-900)]">{org.organization.stripe_subscription_id || '-'}</p>
              </div>
              <div>
                <p className="text-[var(--color-gray-500)]">Created</p>
                <p className="text-[var(--color-gray-900)]">
                  {new Date(org.organization.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Credits Modal */}
      <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credits to Organization</DialogTitle>
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
                Current balance: {org.credits.balance}
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
                <option value="team">Team</option>
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
              <Label>Plan Type</Label>
              <select
                value={planForm.plan_type}
                onChange={(e) => setPlanForm({ ...planForm, plan_type: e.target.value })}
                className="mt-1 w-full rounded-md border border-[var(--color-gray-200)] px-3 py-2"
              >
                <option value="team">Team</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <Label>Seats Purchased</Label>
              <Input
                type="number"
                value={planForm.seats_purchased}
                onChange={(e) => setPlanForm({ ...planForm, seats_purchased: e.target.value })}
                className="mt-1"
              />
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

      {/* Edit Org Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Subdomain</Label>
              <Input
                value={editForm.subdomain}
                onChange={(e) => setEditForm({ ...editForm, subdomain: e.target.value })}
                placeholder="e.g., acme"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Custom Domain</Label>
              <Input
                value={editForm.custom_domain}
                onChange={(e) => setEditForm({ ...editForm, custom_domain: e.target.value })}
                placeholder="e.g., dashboards.acme.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Billing Email</Label>
              <Input
                type="email"
                value={editForm.billing_email}
                onChange={(e) => setEditForm({ ...editForm, billing_email: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOrg} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
