'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { OrganizationWithRole } from '@/types/database';

export default function WorkspaceSettingsPage() {
  const [organization, setOrganization] = useState<OrganizationWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [name, setName] = useState('');

  // Fetch organization data
  useEffect(() => {
    async function fetchOrganization() {
      try {
        const response = await fetch('/api/organizations');
        if (!response.ok) {
          throw new Error('Failed to fetch organizations');
        }
        const data = await response.json();
        const orgs = data.organizations || [];

        // Get the user's owned organization (primary org)
        const ownedOrg = orgs.find((org: OrganizationWithRole) => org.role === 'owner');
        const selectedOrg = ownedOrg || orgs[0];
        if (selectedOrg) {
          setOrganization(selectedOrg);
          setName(selectedOrg.name);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganization();
  }, []);

  const handleSave = async () => {
    if (!organization) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const updatedOrg = await response.json();
      setOrganization({ ...organization, ...updatedOrg });
      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-gray-500)]">No organization found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
          Organization Settings
        </h1>
        <p className="text-[var(--color-gray-600)] mt-1">
          Configure your organization
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          Settings saved successfully!
        </div>
      )}

      {/* Organization Name */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Name</CardTitle>
          <CardDescription>
            The name of your organization (visible to team members)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Organization"
            />
          </div>
        </CardContent>
      </Card>

      {/* Current Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Information</CardTitle>
          <CardDescription>
            Technical details about your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Organization ID</dt>
              <dd className="font-mono text-[var(--color-gray-700)]">{organization.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Internal Slug</dt>
              <dd className="font-mono text-[var(--color-gray-700)]">{organization.slug}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Your Role</dt>
              <dd className="text-[var(--color-gray-700)] capitalize">{organization.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Created</dt>
              <dd className="text-[var(--color-gray-700)]">
                {new Date(organization.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
