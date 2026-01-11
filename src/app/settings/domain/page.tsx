'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { CustomDomainStatus } from '@/types/database';

interface DomainConfig {
  custom_domain: string | null;
  custom_domain_status: CustomDomainStatus | null;
  custom_domain_verified_at: string | null;
  custom_domain_error: string | null;
  subdomain: string | null;
  cname_target: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function DomainSettingsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [domainConfig, setDomainConfig] = useState<DomainConfig | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Fetch user's organizations
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch('/api/organizations');
        if (response.ok) {
          const data = await response.json();
          // Filter to only orgs where user is admin/owner
          const adminOrgs = data.organizations?.filter(
            (org: { role: string }) => org.role === 'owner' || org.role === 'admin'
          ) || [];
          setOrganizations(adminOrgs);
          if (adminOrgs.length > 0 && !selectedOrgId) {
            setSelectedOrgId(adminOrgs[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
        toast.error('Failed to load organizations');
      } finally {
        setIsLoading(false);
      }
    }
    fetchOrganizations();
  }, [selectedOrgId]);

  // Fetch domain config when org is selected
  const fetchDomainConfig = useCallback(async () => {
    if (!selectedOrgId) return;

    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/domain`);
      if (response.ok) {
        const data = await response.json();
        setDomainConfig(data);
        setNewDomain(data.custom_domain || '');
      } else if (response.status === 403) {
        toast.error('You do not have permission to manage this domain');
      }
    } catch (error) {
      console.error('Failed to fetch domain config:', error);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchDomainConfig();
  }, [fetchDomainConfig]);

  const handleSaveDomain = async () => {
    if (!selectedOrgId || !newDomain.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to save domain');
        return;
      }

      toast.success('Domain saved! Configure your DNS and click Verify.');
      await fetchDomainConfig();
    } catch (error) {
      console.error('Failed to save domain:', error);
      toast.error('Failed to save domain');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!selectedOrgId) return;

    setIsVerifying(true);
    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/domain`, {
        method: 'PUT',
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Verification failed');
        await fetchDomainConfig();
        return;
      }

      if (data.status === 'verified') {
        toast.success('Domain verified and active!');
      } else if (data.status === 'verifying') {
        toast.info('SSL certificate is being provisioned. This may take a few minutes.');
      }

      await fetchDomainConfig();
    } catch (error) {
      console.error('Failed to verify domain:', error);
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!selectedOrgId) return;

    if (!confirm('Are you sure you want to remove this custom domain?')) {
      return;
    }

    setIsRemoving(true);
    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/domain`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || 'Failed to remove domain');
        return;
      }

      toast.success('Domain removed');
      setNewDomain('');
      await fetchDomainConfig();
    } catch (error) {
      console.error('Failed to remove domain:', error);
      toast.error('Failed to remove domain');
    } finally {
      setIsRemoving(false);
    }
  };

  const getStatusBadge = (status: CustomDomainStatus | null) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Verified
          </span>
        );
      case 'verifying':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Verifying...
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending DNS
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)] mb-4">Custom Domain</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            You need to be an admin or owner of an organization to configure custom domains.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/settings')}>
            Back to Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)] mb-2">Custom Domain</h1>
        <p className="text-[var(--color-gray-600)]">
          Configure a custom domain for your organization&apos;s shared dashboards.
        </p>
      </div>

      {/* Organization Selector */}
      {organizations.length > 1 && (
        <div className="mb-6">
          <Label htmlFor="org-select">Organization</Label>
          <select
            id="org-select"
            value={selectedOrgId || ''}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-[var(--color-gray-200)] rounded-lg bg-white text-sm"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current Domain Status */}
      {domainConfig?.custom_domain && (
        <div className="mb-8 p-4 bg-[var(--color-gray-50)] rounded-lg border border-[var(--color-gray-200)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--color-gray-700)]">Current Domain</span>
            {getStatusBadge(domainConfig.custom_domain_status)}
          </div>
          <p className="text-lg font-mono text-[var(--color-gray-900)]">{domainConfig.custom_domain}</p>

          {domainConfig.custom_domain_verified_at && (
            <p className="text-xs text-[var(--color-gray-500)] mt-2">
              Verified on {new Date(domainConfig.custom_domain_verified_at).toLocaleDateString()}
            </p>
          )}

          {domainConfig.custom_domain_error && domainConfig.custom_domain_status !== 'verified' && (
            <p className="text-sm text-red-600 mt-2">{domainConfig.custom_domain_error}</p>
          )}
        </div>
      )}

      {/* Domain Input */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="domain">Custom Domain</Label>
          <Input
            id="domain"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="dashboards.yourcompany.com"
            className="mt-1"
          />
          <p className="text-xs text-[var(--color-gray-500)] mt-1">
            Enter the domain you want to use for sharing dashboards.
          </p>
        </div>

        {/* DNS Instructions */}
        {domainConfig?.custom_domain && domainConfig?.custom_domain_status !== 'verified' && (() => {
          const domain = domainConfig.custom_domain;
          const parts = domain.split('.');
          // Root domain = exactly 2 parts (e.g., lakhmay.com) or 2 parts with common TLD (e.g., co.uk would be 3)
          const isRootDomain = parts.length === 2 || (parts.length === 3 && ['co', 'com', 'org', 'net'].includes(parts[1]));
          const subdomain = isRootDomain ? '@' : parts.slice(0, -2).join('.');

          return (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
              <h3 className="text-sm font-medium text-blue-900">DNS Configuration Required</h3>

              {isRootDomain ? (
                <>
                  <div className="text-sm text-blue-700">
                    <p className="mb-2">
                      <strong>Root domains</strong> (like {domain}) require special setup because most DNS providers
                      don&apos;t support CNAME records on the root/apex domain.
                    </p>
                  </div>

                  {/* Option 1: A Records */}
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-2">Option 1: A Records (works with all providers)</p>
                    <div className="font-mono text-sm space-y-1">
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-[var(--color-gray-500)]">Type:</span>
                        <span>A</span>
                        <span className="text-[var(--color-gray-500)]">Name:</span>
                        <span>@ <span className="text-[var(--color-gray-400)]">(or leave blank)</span></span>
                        <span className="text-[var(--color-gray-500)]">Value:</span>
                        <span>76.76.21.21</span>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: CNAME Flattening */}
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-2">Option 2: CNAME Flattening (Cloudflare, Route53, etc.)</p>
                    <p className="text-xs text-[var(--color-gray-600)] mb-2">
                      If your DNS provider supports CNAME flattening or ALIAS records:
                    </p>
                    <div className="font-mono text-sm space-y-1">
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-[var(--color-gray-500)]">Type:</span>
                        <span>CNAME <span className="text-[var(--color-gray-400)]">(or ALIAS)</span></span>
                        <span className="text-[var(--color-gray-500)]">Name:</span>
                        <span>@</span>
                        <span className="text-[var(--color-gray-500)]">Value:</span>
                        <span className="break-all">{domainConfig.cname_target}</span>
                      </div>
                    </div>
                  </div>

                  {/* www subdomain */}
                  <div className="bg-white p-3 rounded border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-2">Also add for www (recommended)</p>
                    <div className="font-mono text-sm space-y-1">
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-[var(--color-gray-500)]">Type:</span>
                        <span>CNAME</span>
                        <span className="text-[var(--color-gray-500)]">Name:</span>
                        <span>www</span>
                        <span className="text-[var(--color-gray-500)]">Value:</span>
                        <span className="break-all">{domainConfig.cname_target}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-blue-700">
                    Add the following CNAME record to your DNS settings:
                  </p>
                  <div className="bg-white p-3 rounded border border-blue-200 font-mono text-sm">
                    <div className="grid grid-cols-[80px_1fr] gap-2">
                      <span className="text-[var(--color-gray-500)]">Type:</span>
                      <span>CNAME</span>
                      <span className="text-[var(--color-gray-500)]">Name:</span>
                      <span>{subdomain}</span>
                      <span className="text-[var(--color-gray-500)]">Value:</span>
                      <span className="break-all">{domainConfig.cname_target}</span>
                    </div>
                  </div>
                </>
              )}

              <p className="text-xs text-blue-600">
                DNS changes can take up to 48 hours to propagate, but usually complete within a few minutes.
              </p>
            </div>
          );
        })()}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {!domainConfig?.custom_domain || newDomain !== domainConfig.custom_domain ? (
            <Button
              onClick={handleSaveDomain}
              disabled={isSaving || !newDomain.trim()}
            >
              {isSaving ? 'Saving...' : 'Save Domain'}
            </Button>
          ) : (
            <>
              {domainConfig.custom_domain_status !== 'verified' && (
                <Button onClick={handleVerifyDomain} disabled={isVerifying}>
                  {isVerifying ? 'Verifying...' : 'Verify Domain'}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleRemoveDomain}
                disabled={isRemoving}
                className="text-red-600 hover:text-red-700 hover:border-red-300"
              >
                {isRemoving ? 'Removing...' : 'Remove Domain'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Subdomain Info */}
      {domainConfig?.subdomain && (
        <div className="mt-8 pt-8 border-t border-[var(--color-gray-200)]">
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">Subdomain</h2>
          <p className="text-sm text-[var(--color-gray-600)] mb-2">
            Your organization also has a subdomain that works automatically:
          </p>
          <p className="font-mono text-[var(--color-primary)]">
            {domainConfig.subdomain}.zeno.fyi
          </p>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-8 pt-8 border-t border-[var(--color-gray-200)]">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Need Help?</h2>
        <div className="space-y-3 text-sm text-[var(--color-gray-600)]">
          <p>
            <strong>Step 1:</strong> Enter your custom domain above (e.g., dashboards.yourcompany.com)
          </p>
          <p>
            <strong>Step 2:</strong> Add the CNAME record to your DNS provider (GoDaddy, Cloudflare, etc.)
          </p>
          <p>
            <strong>Step 3:</strong> Click &quot;Verify Domain&quot; once DNS changes have propagated
          </p>
          <p>
            <strong>Step 4:</strong> Your dashboards will be accessible at your custom domain!
          </p>
        </div>
      </div>
    </div>
  );
}
