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
import type { Workspace } from '@/types/database';

export default function WorkspaceSettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);

  // Fetch workspace data
  useEffect(() => {
    async function fetchWorkspace() {
      try {
        const response = await fetch('/api/workspaces');
        if (!response.ok) {
          throw new Error('Failed to fetch workspaces');
        }
        const data = await response.json();
        const workspaces = data.workspaces as Workspace[];

        // Get the first personal workspace
        const personalWorkspace = workspaces.find((w) => w.type === 'personal');
        if (personalWorkspace) {
          setWorkspace(personalWorkspace);
          setName(personalWorkspace.name);
          setSubdomain(personalWorkspace.subdomain || '');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchWorkspace();
  }, []);

  // Validate subdomain format
  const validateSubdomain = (value: string): string | null => {
    if (!value) return null; // Empty is allowed (removes subdomain)

    if (value.length < 3) {
      return 'Subdomain must be at least 3 characters';
    }
    if (value.length > 63) {
      return 'Subdomain must be 63 characters or less';
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
      return 'Subdomain can only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens)';
    }
    return null;
  };

  // Check subdomain availability with debounce
  useEffect(() => {
    const formatError = validateSubdomain(subdomain);
    if (formatError) {
      setSubdomainError(formatError);
      setSubdomainAvailable(null);
      return;
    }

    // If subdomain is same as current, it's available
    if (subdomain === (workspace?.subdomain || '')) {
      setSubdomainError(null);
      setSubdomainAvailable(null);
      return;
    }

    if (!subdomain) {
      setSubdomainError(null);
      setSubdomainAvailable(null);
      return;
    }

    setIsCheckingSubdomain(true);
    setSubdomainError(null);
    setSubdomainAvailable(null);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/workspaces/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`);
        const data = await response.json();

        if (data.available) {
          setSubdomainAvailable(true);
          setSubdomainError(null);
        } else {
          setSubdomainAvailable(false);
          setSubdomainError(data.reason || 'Subdomain is not available');
        }
      } catch (err) {
        setSubdomainError('Failed to check availability');
      } finally {
        setIsCheckingSubdomain(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [subdomain, workspace?.subdomain]);

  const handleSave = async () => {
    if (!workspace) return;

    // Validate before saving
    const formatError = validateSubdomain(subdomain);
    if (formatError) {
      setSubdomainError(formatError);
      return;
    }

    if (subdomainAvailable === false) {
      return; // Don't save if subdomain is not available
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subdomain: subdomain || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const data = await response.json();
      setWorkspace(data.workspace);
      setSuccess(true);
      setSubdomainAvailable(null);

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

  if (!workspace) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-gray-500)]">No workspace found.</p>
      </div>
    );
  }

  const subdomainUrl = subdomain
    ? `https://${subdomain}.zeno.app`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
          Workspace Settings
        </h1>
        <p className="text-[var(--color-gray-600)] mt-1">
          Configure your workspace name and custom subdomain
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

      {/* Workspace Name */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Name</CardTitle>
          <CardDescription>
            The name of your workspace (visible to you only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
            />
          </div>
        </CardContent>
      </Card>

      {/* Subdomain */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Subdomain</CardTitle>
          <CardDescription>
            Create a branded URL for your workspace dashboards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center flex-1">
                <span className="px-3 py-2 bg-[var(--color-gray-100)] border border-r-0 border-[var(--color-gray-200)] rounded-l-lg text-sm text-[var(--color-gray-500)]">
                  https://
                </span>
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  placeholder="acme"
                  className="rounded-none border-x-0"
                />
                <span className="px-3 py-2 bg-[var(--color-gray-100)] border border-l-0 border-[var(--color-gray-200)] rounded-r-lg text-sm text-[var(--color-gray-500)]">
                  .zeno.app
                </span>
              </div>
              {isCheckingSubdomain && (
                <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              )}
              {!isCheckingSubdomain && subdomainAvailable === true && (
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {!isCheckingSubdomain && subdomainAvailable === false && (
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            {subdomainError && (
              <p className="text-sm text-red-600">{subdomainError}</p>
            )}
            {subdomainAvailable === true && (
              <p className="text-sm text-green-600">Subdomain is available!</p>
            )}
            <p className="text-xs text-[var(--color-gray-500)]">
              Choose a unique subdomain for your workspace. This will be the URL where your published dashboards are accessible.
            </p>
          </div>

          {/* Preview */}
          {subdomainUrl && !subdomainError && (
            <div className="p-4 bg-[var(--color-gray-50)] rounded-lg">
              <p className="text-sm font-medium text-[var(--color-gray-700)] mb-2">
                Your workspace will be accessible at:
              </p>
              <div className="space-y-1">
                <p className="font-mono text-sm text-[var(--color-primary)]">
                  {subdomainUrl}
                </p>
                <p className="text-xs text-[var(--color-gray-500)]">
                  Homepage showing all published dashboards
                </p>
              </div>
              <div className="mt-2 space-y-1">
                <p className="font-mono text-sm text-[var(--color-primary)]">
                  {subdomainUrl}/your-dashboard-slug
                </p>
                <p className="text-xs text-[var(--color-gray-500)]">
                  Individual dashboard pages
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Workspace Info */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Information</CardTitle>
          <CardDescription>
            Technical details about your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Workspace ID</dt>
              <dd className="font-mono text-[var(--color-gray-700)]">{workspace.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Internal Slug</dt>
              <dd className="font-mono text-[var(--color-gray-700)]">{workspace.slug}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Type</dt>
              <dd className="text-[var(--color-gray-700)] capitalize">{workspace.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Created</dt>
              <dd className="text-[var(--color-gray-700)]">
                {new Date(workspace.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          onClick={handleSave}
          disabled={isSaving || isCheckingSubdomain || subdomainAvailable === false || !!subdomainError}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
