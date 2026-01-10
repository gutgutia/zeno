'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { DashboardShare, ShareViewerType } from '@/types/database';
import { toast } from 'sonner';

type Visibility = 'private' | 'public' | 'specific';

// Detect viewer type based on domain matching
function detectViewerType(ownerDomain: string | null, shareValue: string, shareType: 'email' | 'domain'): ShareViewerType {
  if (!ownerDomain) return 'external';

  if (shareType === 'domain') {
    return shareValue.toLowerCase() === ownerDomain.toLowerCase() ? 'internal' : 'external';
  } else {
    const shareDomain = shareValue.toLowerCase().split('@')[1];
    return shareDomain === ownerDomain.toLowerCase() ? 'internal' : 'external';
  }
}

interface ShareDialogProps {
  dashboardId: string;
  dashboardSlug: string;
  isPublished: boolean;
  sharedWithOrg?: boolean;
  onPublishChange?: (isPublished: boolean) => void;
  onOrgShareChange?: (sharedWithOrg: boolean) => void;
  trigger?: React.ReactNode;
}

export function ShareDialog({
  dashboardId,
  dashboardSlug,
  isPublished,
  sharedWithOrg: initialSharedWithOrg = false,
  onPublishChange,
  onOrgShareChange,
  trigger,
}: ShareDialogProps) {
  const [shares, setShares] = useState<DashboardShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newShareValue, setNewShareValue] = useState('');
  const [shareType, setShareType] = useState<'email' | 'domain'>('email');
  const [viewerTypeOverride, setViewerTypeOverride] = useState<ShareViewerType | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isUpdatingOrgShare, setIsUpdatingOrgShare] = useState(false);
  const [ownerDomain, setOwnerDomain] = useState<string | null>(null);
  const [sharedWithOrg, setSharedWithOrg] = useState(initialSharedWithOrg);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgDomainInfo, setOrgDomainInfo] = useState<{
    subdomain: string | null;
    customDomain: string | null;
  } | null>(null);

  // Auto-detect viewer type based on input
  const detectedViewerType = useMemo(() => {
    if (!newShareValue.trim()) return null;
    return detectViewerType(ownerDomain, newShareValue.trim(), shareType);
  }, [ownerDomain, newShareValue, shareType]);

  // Final viewer type to send (override or detected)
  const finalViewerType = viewerTypeOverride || detectedViewerType;

  // Determine current visibility
  const getVisibility = (): Visibility => {
    if (isPublished) return 'public';
    if (shares.length > 0) return 'specific';
    return 'private';
  };

  const [visibility, setVisibility] = useState<Visibility>(getVisibility());

  // Update visibility when shares or isPublished changes
  useEffect(() => {
    setVisibility(getVisibility());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublished, shares.length]);

  // Fetch shares and org domain info on mount
  useEffect(() => {
    async function fetchSharesAndOrgInfo() {
      setIsLoading(true);
      try {
        // Fetch shares
        const sharesResponse = await fetch(`/api/dashboards/${dashboardId}/shares`);
        if (sharesResponse.ok) {
          const data = await sharesResponse.json();
          setShares(data.shares);
          setOwnerDomain(data.ownerDomain || null);
        }

        // Fetch dashboard to get org domain info and shared_with_org status
        const dashboardResponse = await fetch(`/api/dashboards/${dashboardId}`);
        if (dashboardResponse.ok) {
          const data = await dashboardResponse.json();
          if (data.organization) {
            setOrgName(data.organization.name || null);
            setOrgDomainInfo({
              subdomain: data.organization.subdomain || null,
              customDomain: data.organization.custom_domain || null,
            });
          }
          if (data.dashboard) {
            setSharedWithOrg(data.dashboard.shared_with_org || false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch shares:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSharesAndOrgInfo();
  }, [dashboardId]);

  const handleVisibilityChange = async (newVisibility: Visibility) => {
    if (newVisibility === visibility) return;

    // If changing to/from public, update the published status
    if (newVisibility === 'public' || visibility === 'public') {
      setIsUpdatingVisibility(true);
      try {
        const response = await fetch(`/api/dashboards/${dashboardId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_published: newVisibility === 'public' }),
        });

        if (!response.ok) {
          throw new Error('Failed to update visibility');
        }

        onPublishChange?.(newVisibility === 'public');
        toast.success(
          newVisibility === 'public'
            ? 'Dashboard is now public'
            : 'Dashboard is no longer public'
        );
      } catch (err) {
        console.error('Failed to update visibility:', err);
        toast.error('Failed to update visibility');
        return;
      } finally {
        setIsUpdatingVisibility(false);
      }
    }

    setVisibility(newVisibility);
  };

  const handleOrgShareToggle = async () => {
    setIsUpdatingOrgShare(true);
    const newValue = !sharedWithOrg;

    try {
      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_with_org: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update organization sharing');
      }

      setSharedWithOrg(newValue);
      onOrgShareChange?.(newValue);
      toast.success(
        newValue
          ? `Dashboard shared with all ${orgName || 'organization'} members`
          : 'Dashboard is no longer shared with organization'
      );
    } catch (err) {
      console.error('Failed to update org sharing:', err);
      toast.error('Failed to update organization sharing');
    } finally {
      setIsUpdatingOrgShare(false);
    }
  };

  const handleAddShare = async () => {
    if (!newShareValue.trim()) return;

    setIsAdding(true);
    setError(null);

    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          share_type: shareType,
          share_value: newShareValue.trim(),
          viewer_type: finalViewerType || 'auto',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add share');
        return;
      }

      setShares((prev) => [data.share, ...prev]);
      setNewShareValue('');
      setViewerTypeOverride(null); // Reset override
      const isInternal = data.share.viewer_type === 'internal';
      toast.success(
        shareType === 'email'
          ? `Shared with ${newShareValue.trim()} as ${isInternal ? 'team member' : 'external viewer'}`
          : `Shared with @${newShareValue.trim()} as ${isInternal ? 'team members' : 'external viewers'}`
      );
    } catch (err) {
      setError('Failed to add share');
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/shares/${shareId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
        toast.success('Share removed');
      }
    } catch (err) {
      console.error('Failed to remove share:', err);
      toast.error('Failed to remove share');
    }
  };

  // Build the share URL based on org's domain settings
  const getDashboardUrl = () => {
    // Priority: custom domain > subdomain > fallback
    if (orgDomainInfo?.customDomain) {
      return `https://${orgDomainInfo.customDomain}/${dashboardSlug}`;
    }
    if (orgDomainInfo?.subdomain) {
      return `https://${orgDomainInfo.subdomain}.zeno.fyi/${dashboardSlug}`;
    }
    // Fallback to current origin with /d/ path
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://zeno.fyi';
    return `${origin}/d/${dashboardSlug}`;
  };

  const dashboardUrl = getDashboardUrl();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(dashboardUrl);
    toast.success('Link copied to clipboard');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Dashboard</DialogTitle>
          <DialogDescription>
            Control who can view this dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Visibility Options */}
          <div className="space-y-3">
            <Label>Who can access</Label>
            <div className="space-y-2">
              {/* Private */}
              <label
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  visibility === 'private'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                    : 'border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === 'private'}
                  onChange={() => handleVisibilityChange('private')}
                  disabled={isUpdatingVisibility}
                  className="sr-only"
                />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  visibility === 'private' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-gray-100)] text-[var(--color-gray-500)]'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-gray-900)]">Private</p>
                  <p className="text-xs text-[var(--color-gray-500)]">Only you can view</p>
                </div>
                {visibility === 'private' && (
                  <svg className="w-5 h-5 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </label>

              {/* Anyone with link */}
              <label
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  visibility === 'public'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                    : 'border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === 'public'}
                  onChange={() => handleVisibilityChange('public')}
                  disabled={isUpdatingVisibility}
                  className="sr-only"
                />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  visibility === 'public' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-gray-100)] text-[var(--color-gray-500)]'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-gray-900)]">Anyone with the link</p>
                  <p className="text-xs text-[var(--color-gray-500)]">Anyone on the internet can view</p>
                </div>
                {visibility === 'public' && (
                  <svg className="w-5 h-5 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </label>

              {/* Specific people/domains */}
              <label
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  visibility === 'specific'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                    : 'border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === 'specific'}
                  onChange={() => handleVisibilityChange('specific')}
                  disabled={isUpdatingVisibility}
                  className="sr-only"
                />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  visibility === 'specific' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-gray-100)] text-[var(--color-gray-500)]'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-gray-900)]">Specific people or domains</p>
                  <p className="text-xs text-[var(--color-gray-500)]">
                    {shares.length > 0 ? `${shares.length} ${shares.length === 1 ? 'person/domain' : 'people/domains'} with access` : 'Invite by email or domain'}
                  </p>
                </div>
                {visibility === 'specific' && (
                  <svg className="w-5 h-5 text-[var(--color-primary)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </label>
            </div>
          </div>

          {/* Organization sharing toggle - show when not public */}
          {visibility !== 'public' && orgName && (
            <div className="pt-2 border-t border-[var(--color-gray-200)]">
              <div className="flex items-center justify-between p-3 bg-[var(--color-gray-50)] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    sharedWithOrg ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-gray-200)] text-[var(--color-gray-500)]'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-gray-900)]">
                      Share with organization
                    </p>
                    <p className="text-xs text-[var(--color-gray-500)]">
                      All members of <span className="font-medium">{orgName}</span> can view
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOrgShareToggle}
                  disabled={isUpdatingOrgShare}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${
                    sharedWithOrg ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-gray-300)]'
                  } ${isUpdatingOrgShare ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      sharedWithOrg ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Share form - only show when 'specific' is selected */}
          {visibility === 'specific' && (
            <div className="space-y-3 pt-2 border-t border-[var(--color-gray-200)]">
              <Label>Add people or domains</Label>
              <div className="flex gap-2">
                <select
                  value={shareType}
                  onChange={(e) => {
                    setShareType(e.target.value as 'email' | 'domain');
                    setViewerTypeOverride(null); // Reset override when changing type
                  }}
                  className="px-3 py-2 border border-[var(--color-gray-200)] rounded-lg text-sm bg-white"
                >
                  <option value="email">Email</option>
                  <option value="domain">Domain</option>
                </select>
                <Input
                  value={newShareValue}
                  onChange={(e) => {
                    setNewShareValue(e.target.value);
                    setViewerTypeOverride(null); // Reset override when typing
                  }}
                  placeholder={shareType === 'email' ? 'user@example.com' : 'company.com'}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddShare();
                    }
                  }}
                />
                <Button onClick={handleAddShare} disabled={isAdding || !newShareValue.trim()}>
                  {isAdding ? '...' : 'Add'}
                </Button>
              </div>

              {/* Viewer type detection/selection */}
              {newShareValue.trim() && detectedViewerType && (
                <div className="p-3 bg-[var(--color-gray-50)] rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-gray-600)]">Access type:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setViewerTypeOverride(viewerTypeOverride === 'internal' ? null : 'internal')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                          finalViewerType === 'internal'
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-white text-[var(--color-gray-500)] border border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
                        }`}
                      >
                        Team member
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewerTypeOverride(viewerTypeOverride === 'external' ? null : 'external')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                          finalViewerType === 'external'
                            ? 'bg-amber-100 text-amber-700 border border-amber-300'
                            : 'bg-white text-[var(--color-gray-500)] border border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)]'
                        }`}
                      >
                        External viewer
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-gray-500)]">
                    {finalViewerType === 'internal' ? (
                      <>
                        <span className="font-medium">Team member:</span> Will create a Zeno account and join your organization
                      </>
                    ) : (
                      <>
                        <span className="font-medium">External viewer:</span> Can view this dashboard only, no account created
                      </>
                    )}
                    {!viewerTypeOverride && detectedViewerType && (
                      <span className="text-[var(--color-gray-400)]"> (auto-detected)</span>
                    )}
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
              <p className="text-xs text-[var(--color-gray-500)]">
                {shareType === 'email'
                  ? 'They will receive an email notification'
                  : 'Everyone with this email domain can access'}
              </p>

              {/* Current shares */}
              {isLoading ? (
                <div className="text-center py-4 text-[var(--color-gray-500)]">Loading...</div>
              ) : shares.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-2 bg-[var(--color-gray-50)] rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                          share.share_type === 'domain' ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-secondary)]'
                        }`}>
                          {share.share_type === 'domain' ? '@' : share.share_value.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--color-gray-900)]">
                            {share.share_type === 'domain' ? `@${share.share_value}` : share.share_value}
                          </p>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            share.viewer_type === 'internal'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            {share.viewer_type === 'internal' ? 'Team' : 'External'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveShare(share.id)}
                        className="p-1 text-[var(--color-gray-400)] hover:text-[var(--color-error)] transition-colors"
                        title="Remove access"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Dashboard Link - always show */}
          <div className="pt-4 border-t border-[var(--color-gray-200)]">
            <Label className="mb-2 block">Dashboard link</Label>
            <div className="flex gap-2">
              <Input
                value={dashboardUrl}
                readOnly
                className="flex-1 text-sm bg-[var(--color-gray-50)]"
              />
              <Button variant="outline" onClick={handleCopyLink}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </Button>
            </div>
            <p className="text-xs text-[var(--color-gray-500)] mt-1">
              {visibility === 'private'
                ? 'Only you can access this link'
                : visibility === 'public'
                ? 'Anyone with this link can view'
                : 'Only invited people can access this link'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
