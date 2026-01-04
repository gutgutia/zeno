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

export default function TeamPage() {
  const [organization, setOrganization] = useState<OrganizationWithRole | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
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
    }
  }, [organization]);

  const fetchOrganization = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        // Get the user's owned organization (primary org)
        const ownedOrg = data.find((org: OrganizationWithRole) => org.role === 'owner');
        if (ownedOrg || data[0]) {
          setOrganization(ownedOrg || data[0]);
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
          const ownedOrg = data.find((org: OrganizationWithRole) => org.role === 'owner');
          setOrganization(ownedOrg || data[0] || null);
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
            <Button onClick={() => setIsInviteDialogOpen(true)}>Invite Team Member</Button>
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
    </div>
  );
}
