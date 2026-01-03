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
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationWithRole | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateOrgDialogOpen, setIsCreateOrgDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchMembers(selectedOrg.id);
      fetchInvitations(selectedOrg.id);
    }
  }, [selectedOrg]);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
        if (data.length > 0 && !selectedOrg) {
          setSelectedOrg(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setIsLoading(false);
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

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) {
      toast.error('Name and slug are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOrgName,
          slug: newOrgSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      setOrganizations([...organizations, data]);
      setSelectedOrg(data);
      setIsCreateOrgDialogOpen(false);
      setNewOrgName('');
      setNewOrgSlug('');
      toast.success('Organization created!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedOrg) {
      toast.error('Email is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/organizations/${selectedOrg.id}/members`, {
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
      fetchInvitations(selectedOrg.id);
      toast.success('Invitation sent!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!selectedOrg) return;

    try {
      const response = await fetch(
        `/api/organizations/${selectedOrg.id}/invitations?invitationId=${invitationId}`,
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
    if (!selectedOrg) return;

    try {
      const response = await fetch(`/api/organizations/${selectedOrg.id}/members/${userId}`, {
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
    if (!selectedOrg) return;

    try {
      const response = await fetch(`/api/organizations/${selectedOrg.id}/members/${userId}`, {
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

  const canManageMembers = selectedOrg?.role === 'owner' || selectedOrg?.role === 'admin';
  const isOwner = selectedOrg?.role === 'owner';

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[var(--color-gray-200)] rounded" />
          <div className="h-32 bg-[var(--color-gray-200)] rounded-xl" />
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
          <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Team Management</h1>
          <Button onClick={() => setIsCreateOrgDialogOpen(true)}>Create Organization</Button>
        </div>
      </div>

      {organizations.length === 0 ? (
        /* No Organizations */
        <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-8 text-center">
          <div className="w-16 h-16 bg-[var(--color-gray-100)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">No Organizations Yet</h2>
          <p className="text-[var(--color-gray-500)] mb-6 max-w-md mx-auto">
            Create an organization to collaborate with your team, share dashboards, and manage billing together.
          </p>
          <Button onClick={() => setIsCreateOrgDialogOpen(true)}>Create Your First Organization</Button>
        </div>
      ) : (
        <>
          {/* Organization Selector */}
          {organizations.length > 1 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-gray-700)] mb-2">
                Select Organization
              </label>
              <select
                value={selectedOrg?.id || ''}
                onChange={(e) => {
                  const org = organizations.find((o) => o.id === e.target.value);
                  setSelectedOrg(org || null);
                }}
                className="w-full md:w-64 px-3 py-2 border border-[var(--color-gray-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedOrg && (
            <>
              {/* Organization Info */}
              <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-gray-900)]">{selectedOrg.name}</h2>
                    <p className="text-sm text-[var(--color-gray-500)]">
                      {selectedOrg.member_count} member{selectedOrg.member_count !== 1 ? 's' : ''} · {selectedOrg.plan_type} plan
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-[var(--color-gray-100)] text-[var(--color-gray-600)] rounded-full capitalize">
                    {selectedOrg.role}
                  </span>
                </div>
              </div>

              {/* Members */}
              <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[var(--color-gray-900)]">Members</h3>
                  {canManageMembers && (
                    <Button size="sm" onClick={() => setIsInviteDialogOpen(true)}>
                      Invite Member
                    </Button>
                  )}
                </div>

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
            </>
          )}
        </>
      )}

      {/* Create Organization Dialog */}
      <Dialog open={isCreateOrgDialogOpen} onOpenChange={setIsCreateOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create an organization to collaborate with your team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-gray-700)] mb-1">
                Organization Name
              </label>
              <Input
                value={newOrgName}
                onChange={(e) => {
                  setNewOrgName(e.target.value);
                  setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                }}
                placeholder="Acme Inc"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-gray-700)] mb-1">
                URL Slug
              </label>
              <Input
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="acme-inc"
              />
              <p className="text-xs text-[var(--color-gray-500)] mt-1">
                This will be used in URLs: zeno.fyi/org/{newOrgSlug || 'your-slug'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOrgDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrg} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join {selectedOrg?.name}.
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
