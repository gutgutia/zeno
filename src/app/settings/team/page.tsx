'use client';

import { useState, useEffect } from 'react';
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
import type { OrganizationWithRole } from '@/types/database';
import { usePlan } from '@/lib/hooks';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';

interface Member {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'member';
  invited_at: string;
  accepted_at: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'member';
  expires_at: string;
  created_at: string;
  invited_by: { name: string } | null;
}

interface SeatInfo {
  seats_purchased: number;
  seats_used: number;
  seats_pending: number;
  seats_available: number;
  plan_type: string;
  billing_cycle: 'monthly' | 'annual';
  has_subscription: boolean;
  subscription_ends_at: string | null;
  credits_per_seat: number;
  price_per_seat: number;
  price_per_seat_monthly: number;
  price_per_seat_annual: number;
}

export default function TeamPage() {
  const [organization, setOrganization] = useState<OrganizationWithRole | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isAddSeatDialogOpen, setIsAddSeatDialogOpen] = useState(false);
  const [isRemoveSeatDialogOpen, setIsRemoveSeatDialogOpen] = useState(false);
  const [seatsToAdd, setSeatsToAdd] = useState(1);
  const [seatsToRemove, setSeatsToRemove] = useState(1);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check user's plan for team_members feature
  const { features, isLoading: isPlanLoading } = usePlan();
  const canAddTeamMembers = features.team_members;

  useEffect(() => {
    fetchOrganization();
  }, []);

  useEffect(() => {
    if (organization) {
      fetchMembers(organization.id);
      fetchInvitations(organization.id);
      fetchSeatInfo(organization.id);
    }
  }, [organization]);

  const fetchOrganization = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        const orgs = data.organizations || [];
        // Get the user's owned organization (primary org)
        const ownedOrg = orgs.find((org: OrganizationWithRole) => org.role === 'owner');
        if (ownedOrg || orgs[0]) {
          setOrganization(ownedOrg || orgs[0]);
        } else {
          // No org found - create one for this legacy user
          await ensureOrganization();
        }
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const ensureOrganization = async () => {
    setIsCreatingOrg(true);
    try {
      const response = await fetch('/api/organizations/ensure', {
        method: 'POST',
      });
      if (response.ok) {
        // Refetch organizations after creation
        const orgsResponse = await fetch('/api/organizations');
        if (orgsResponse.ok) {
          const data = await orgsResponse.json();
          const orgs = data.organizations || [];
          const ownedOrg = orgs.find((org: OrganizationWithRole) => org.role === 'owner');
          setOrganization(ownedOrg || orgs[0] || null);
        }
      }
    } catch (error) {
      console.error('Failed to ensure organization:', error);
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const fetchMembers = async (orgId: string) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const fetchInvitations = async (orgId: string) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/invitations`);
      if (response.ok) {
        const data = await response.json();
        setInvitations(data);
      }
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  };

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

  const handleAddSeats = async () => {
    if (!organization || !seatInfo) return;

    setIsSubmitting(true);
    try {
      const newTotal = seatInfo.seats_purchased + seatsToAdd;
      const response = await fetch('/api/billing/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organization.id,
          seats: newTotal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add seats');
      }

      setIsAddSeatDialogOpen(false);
      setSeatsToAdd(1);
      fetchSeatInfo(organization.id);
      toast.success(data.message || `Added ${seatsToAdd} seat(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add seats');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSeats = async () => {
    if (!organization || !seatInfo) return;

    setIsSubmitting(true);
    try {
      const newTotal = seatInfo.seats_purchased - seatsToRemove;
      const response = await fetch('/api/billing/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organization.id,
          seats: newTotal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove seats');
      }

      setIsRemoveSeatDialogOpen(false);
      setSeatsToRemove(1);
      fetchSeatInfo(organization.id);
      toast.success(data.message || `Reduced to ${newTotal} seat(s). Change takes effect next billing cycle.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove seats');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !organization) {
      toast.error('Email is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/organizations/${organization.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          inviteRole: inviteRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('member');
      fetchInvitations(organization.id);
      toast.success('Invitation sent!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!organization) return;

    try {
      const response = await fetch(
        `/api/organizations/${organization.id}/invitations?invitationId=${invitationId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to revoke invitation');
      }

      setInvitations(invitations.filter((i) => i.id !== invitationId));
      toast.success('Invitation revoked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke invitation');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!organization) return;

    try {
      const response = await fetch(`/api/organizations/${organization.id}/members/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      setMembers(members.filter((m) => m.user_id !== userId));
      toast.success('Member removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove member');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'member') => {
    if (!organization) return;

    try {
      const response = await fetch(`/api/organizations/${organization.id}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      setMembers(members.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m)));
      toast.success('Role updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    }
  };

  const canManageMembers = organization?.role === 'owner' || organization?.role === 'admin';
  const isOwner = organization?.role === 'owner';

  if (isLoading || isCreatingOrg || isPlanLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[var(--color-gray-500)] mb-2">
            <Link href="/settings" className="hover:text-[var(--color-gray-700)]">
              Settings
            </Link>
            <span>/</span>
            <span>Team</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Team</h1>
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-8 text-center">
          <div className="w-16 h-16 bg-[var(--color-gray-100)] rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
            {isCreatingOrg ? 'Setting up your team...' : 'Loading...'}
          </h2>
        </div>
      </div>
    );
  }

  // If no organization exists after trying to create, show error
  if (!organization) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[var(--color-gray-500)] mb-2">
            <Link href="/settings" className="hover:text-[var(--color-gray-700)]">
              Settings
            </Link>
            <span>/</span>
            <span>Team</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Team</h1>
        </div>

        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">Something went wrong</h2>
          <p className="text-[var(--color-gray-500)] mb-4">
            We couldn't set up your team. Please try again or contact support.
          </p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-[var(--color-gray-500)] mb-2">
          <Link href="/settings" className="hover:text-[var(--color-gray-700)]">
            Settings
          </Link>
          <span>/</span>
          <span>Team</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Team</h1>
          {canManageMembers && canAddTeamMembers && (
            seatInfo && seatInfo.seats_available <= 0 ? (
              <Button
                variant="outline"
                onClick={() => setIsAddSeatDialogOpen(true)}
              >
                Add Seats to Invite
              </Button>
            ) : (
              <Button onClick={() => setIsInviteDialogOpen(true)}>Invite Team Member</Button>
            )
          )}
        </div>
      </div>

      {/* Upgrade prompt for free users */}
      {!canAddTeamMembers && (
        <UpgradePrompt
          title="Team Collaboration"
          description="Invite team members to collaborate on dashboards, share access, and manage your workspace together."
          requiredPlan="starter"
          className="mb-6"
        />
      )}

      {/* Seat Info Section */}
      {seatInfo && seatInfo.has_subscription && canAddTeamMembers && (
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-6">
          {/* Cancellation Warning */}
          {seatInfo.subscription_ends_at && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100 mb-4">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Subscription is scheduled to cancel</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  To add more seats, please <Link href="/settings/billing" className="underline">reactivate your subscription</Link> first.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-[var(--color-gray-900)] mb-1">Team Seats</h3>
              <p className="text-sm text-[var(--color-gray-500)]">
                {seatInfo.credits_per_seat} credits per seat per month
              </p>
            </div>
            {canManageMembers && !seatInfo.subscription_ends_at && (
              <div className="flex items-center gap-2">
                {seatInfo.seats_available > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSeatsToRemove(1);
                      setIsRemoveSeatDialogOpen(true);
                    }}
                  >
                    Remove Seats
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setIsAddSeatDialogOpen(true)}>
                  Add Seats
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[var(--color-gray-100)]">
            <div>
              <div className="text-2xl font-bold text-[var(--color-gray-900)]">
                {seatInfo.seats_purchased}
              </div>
              <div className="text-sm text-[var(--color-gray-500)]">Total Seats</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--color-gray-900)]">
                {seatInfo.seats_used}
              </div>
              <div className="text-sm text-[var(--color-gray-500)]">Used</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {seatInfo.seats_available}
              </div>
              <div className="text-sm text-[var(--color-gray-500)]">Available</div>
            </div>
          </div>

          {seatInfo.seats_pending > 0 && (
            <p className="text-sm text-amber-600 mt-3">
              {seatInfo.seats_pending} pending invitation{seatInfo.seats_pending > 1 ? 's' : ''} (counts toward seat limit)
            </p>
          )}

          {seatInfo.seats_available === 0 && (
            <p className="text-sm text-[var(--color-gray-500)] mt-3">
              All seats are in use. Add more seats to invite additional team members.
            </p>
          )}
        </div>
      )}

      {/* Members Section */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-6">
        <h3 className="font-semibold text-[var(--color-gray-900)] mb-4">
          Team Members ({members.length})
        </h3>

        {members.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--color-gray-500)] mb-4">
              {canAddTeamMembers
                ? "You're the only member. Invite your team to collaborate!"
                : "You're the only member."}
            </p>
            {canManageMembers && canAddTeamMembers && (
              <Button onClick={() => setIsInviteDialogOpen(true)}>
                Invite Your First Team Member
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-3 border-b border-[var(--color-gray-100)] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[var(--color-gray-200)] rounded-full flex items-center justify-center">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <span className="text-lg font-medium text-[var(--color-gray-600)]">
                        {(member.name || member.email || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-[var(--color-gray-900)]">
                      {member.name || member.email || 'Unknown'}
                    </div>
                    {member.email && member.name && (
                      <div className="text-sm text-[var(--color-gray-500)]">{member.email}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {canManageMembers && member.role !== 'owner' ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.user_id, e.target.value as 'admin' | 'member')}
                      disabled={!isOwner && member.role === 'admin'}
                      className="px-2 py-1 text-sm border border-[var(--color-gray-200)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-[var(--color-gray-100)] text-[var(--color-gray-600)] rounded-full capitalize">
                      {member.role}
                    </span>
                  )}

                  {canManageMembers && member.role !== 'owner' && (isOwner || member.role !== 'admin') && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="p-1 text-[var(--color-gray-400)] hover:text-red-500 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {canManageMembers && invitations.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6">
          <h3 className="font-semibold text-[var(--color-gray-900)] mb-4">Pending Invitations</h3>

          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between py-3 border-b border-[var(--color-gray-100)] last:border-0"
              >
                <div>
                  <div className="font-medium text-[var(--color-gray-900)]">{invitation.email}</div>
                  <div className="text-sm text-[var(--color-gray-500)]">
                    Invited as {invitation.role} · Expires{' '}
                    {new Date(invitation.expires_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeInvitation(invitation.id)}
                  className="text-sm text-red-500 hover:text-red-600"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team. They'll receive an email with a link to accept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-gray-700)] mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-gray-700)] mb-1">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                className="w-full px-3 py-2 border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="member">Member - Can view and create dashboards</option>
                <option value="admin">Admin - Can also manage members and billing</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Seats Dialog */}
      <Dialog open={isAddSeatDialogOpen} onOpenChange={setIsAddSeatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Seats</DialogTitle>
            <DialogDescription>
              Add more seats to invite additional team members. You&apos;ll be charged immediately for the prorated amount.
            </DialogDescription>
          </DialogHeader>

          {seatInfo && (
            <div className="space-y-4 py-4">
              <div className="bg-[var(--color-gray-50)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--color-gray-600)]">Current seats</span>
                  <span className="font-medium">{seatInfo.seats_purchased}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--color-gray-600)]">Billing cycle</span>
                  <span className="font-medium capitalize">{seatInfo.billing_cycle}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-gray-600)]">Price per seat</span>
                  <span className="font-medium">
                    {seatInfo.billing_cycle === 'annual'
                      ? `$${seatInfo.price_per_seat_annual}/year`
                      : `$${seatInfo.price_per_seat}/mo`}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-gray-700)] mb-1">
                  Seats to add
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSeatsToAdd(Math.max(1, seatsToAdd - 1))}
                    className="w-10 h-10 rounded-lg border border-[var(--color-gray-200)] flex items-center justify-center hover:bg-[var(--color-gray-50)]"
                  >
                    -
                  </button>
                  <Input
                    type="number"
                    value={seatsToAdd}
                    onChange={(e) => setSeatsToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center"
                    min={1}
                  />
                  <button
                    onClick={() => setSeatsToAdd(seatsToAdd + 1)}
                    className="w-10 h-10 rounded-lg border border-[var(--color-gray-200)] flex items-center justify-center hover:bg-[var(--color-gray-50)]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-[var(--color-primary)]/5 rounded-lg p-4 border border-[var(--color-primary)]/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-[var(--color-gray-900)]">New total</span>
                  <span className="font-bold text-[var(--color-primary)]">
                    {seatInfo.seats_purchased + seatsToAdd} seats
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-gray-600)]">
                    Additional {seatInfo.billing_cycle === 'annual' ? 'annual' : 'monthly'} cost
                  </span>
                  <span className="text-[var(--color-gray-900)]">
                    {seatInfo.billing_cycle === 'annual'
                      ? `+$${seatsToAdd * seatInfo.price_per_seat_annual}/year`
                      : `+$${seatsToAdd * seatInfo.price_per_seat}/mo`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-[var(--color-gray-600)]">Additional credits/mo</span>
                  <span className="text-green-600">
                    +{seatsToAdd * seatInfo.credits_per_seat} credits
                  </span>
                </div>
              </div>

              <p className="text-xs text-[var(--color-gray-500)]">
                You&apos;ll be charged a prorated amount today based on the time remaining in your billing period.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSeatDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSeats} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : `Add ${seatsToAdd} Seat${seatsToAdd > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Seats Dialog */}
      <Dialog open={isRemoveSeatDialogOpen} onOpenChange={setIsRemoveSeatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Seats</DialogTitle>
            <DialogDescription>
              Reduce your seat count. The change takes effect at the end of your current billing period.
            </DialogDescription>
          </DialogHeader>

          {seatInfo && (
            <div className="space-y-4 py-4">
              <div className="bg-[var(--color-gray-50)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--color-gray-600)]">Current seats</span>
                  <span className="font-medium">{seatInfo.seats_purchased}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--color-gray-600)]">Seats in use</span>
                  <span className="font-medium">{seatInfo.seats_used + seatInfo.seats_pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-gray-600)]">Available to remove</span>
                  <span className="font-medium text-green-600">{seatInfo.seats_available}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-gray-700)] mb-1">
                  Seats to remove
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSeatsToRemove(Math.max(1, seatsToRemove - 1))}
                    className="w-10 h-10 rounded-lg border border-[var(--color-gray-200)] flex items-center justify-center hover:bg-[var(--color-gray-50)]"
                  >
                    -
                  </button>
                  <Input
                    type="number"
                    value={seatsToRemove}
                    onChange={(e) => setSeatsToRemove(Math.max(1, Math.min(seatInfo.seats_available, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center"
                    min={1}
                    max={seatInfo.seats_available}
                  />
                  <button
                    onClick={() => setSeatsToRemove(Math.min(seatInfo.seats_available, seatsToRemove + 1))}
                    className="w-10 h-10 rounded-lg border border-[var(--color-gray-200)] flex items-center justify-center hover:bg-[var(--color-gray-50)]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-[var(--color-gray-900)]">New total</span>
                  <span className="font-bold text-[var(--color-gray-900)]">
                    {seatInfo.seats_purchased - seatsToRemove} seats
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-gray-600)]">
                    {seatInfo.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} savings
                  </span>
                  <span className="text-green-600">
                    {seatInfo.billing_cycle === 'annual'
                      ? `-$${seatsToRemove * seatInfo.price_per_seat_annual}/year`
                      : `-$${seatsToRemove * seatInfo.price_per_seat}/mo`}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-[var(--color-gray-500)]">
                <svg className="w-4 h-4 text-[var(--color-gray-400)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>
                  No refund will be issued. You&apos;ll keep access to {seatInfo.seats_purchased} seats until the end of your billing period, then the change will take effect.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemoveSeatDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRemoveSeats}
              disabled={isSubmitting || !seatInfo || seatsToRemove > seatInfo.seats_available}
              variant="destructive"
            >
              {isSubmitting ? 'Removing...' : `Remove ${seatsToRemove} Seat${seatsToRemove > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
