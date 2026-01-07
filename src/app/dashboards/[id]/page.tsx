'use client';

import { useState, useEffect, use, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageRenderer } from '@/components/dashboard/PageRenderer';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { UpdateDataModal } from '@/components/dashboard/UpdateDataModal';
import { VersionHistoryPanel } from '@/components/dashboard/VersionHistoryPanel';
import { ModifyWithAIModal } from '@/components/dashboard/ModifyWithAIModal';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { toast } from 'sonner';
import type { Dashboard, BrandingConfig, DashboardVersion } from '@/types/database';
import type { DashboardConfig, GenerationStatus } from '@/types/dashboard';

const POLL_INTERVAL = 3000; // 3 seconds

/**
 * Format a date as relative time or absolute date
 */
function formatLastUpdated(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      return `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export default function DashboardEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Version history state
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [previewingVersion, setPreviewingVersion] = useState<{
    id: string;
    html: string;
    major: number;
    minor: number;
  } | null>(null);

  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upgrade modal state
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState<{ needed: number; available: number } | null>(null);

  // Compute CSS variables for branding
  const brandingStyles = useMemo(() => {
    if (!branding?.colors) return {};
    return {
      '--brand-primary': branding.colors.primary,
      '--brand-secondary': branding.colors.secondary,
      '--brand-accent': branding.colors.accent,
      '--brand-background': branding.colors.background,
    } as React.CSSProperties;
  }, [branding]);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/dashboards/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/dashboards');
          return null;
        }
        throw new Error('Failed to fetch dashboard');
      }
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, [id, router]);

  // Initial fetch
  useEffect(() => {
    async function init() {
      const data = await fetchDashboard();
      if (data) {
        setDashboard(data.dashboard);
        setBranding(data.branding || null);
        setEditedTitle(data.dashboard.title);
      }
      setIsLoading(false);
    }
    init();
  }, [fetchDashboard]);

  // Poll for generation/refresh status updates
  useEffect(() => {
    if (!dashboard) return;

    const status = dashboard.generation_status as GenerationStatus;
    const isGenerating = status === 'pending' || status === 'analyzing' || status === 'generating';
    const isRefreshingStatus = status === 'refreshing';

    // Poll during both generation and refresh
    if (!isGenerating && !isRefreshingStatus) return;

    const interval = setInterval(async () => {
      const data = await fetchDashboard();
      if (data) {
        const newStatus = data.dashboard.generation_status as GenerationStatus;
        const oldStatus = dashboard.generation_status;
        setDashboard(data.dashboard);

        if (newStatus === 'completed') {
          // Different messages for generation vs refresh
          if (oldStatus === 'refreshing' || isRefreshingStatus) {
            toast.success('Dashboard updated with new data!');
          } else {
            toast.success('Your dashboard is ready!');
          }
          clearInterval(interval);
        } else if (newStatus === 'failed') {
          if (oldStatus === 'refreshing' || isRefreshingStatus) {
            toast.error('Data update failed. Please try again.');
          } else {
            toast.error('Generation failed. Please try again.');
          }
          clearInterval(interval);
        }
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [dashboard?.generation_status, fetchDashboard]);

  const handleTitleSave = async () => {
    if (!dashboard || !editedTitle.trim()) return;

    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editedTitle.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update title');
      }

      const data = await response.json();
      setDashboard(data.dashboard);
      setIsEditingTitle(false);
      toast.success('Title updated');
    } catch (err) {
      console.error('Failed to save title:', err);
      toast.error('Failed to update title');
    }
  };

  // Handler when modification is complete - refetch dashboard
  const handleModificationComplete = useCallback(async () => {
    const data = await fetchDashboard();
    if (data) {
      setDashboard(data.dashboard);
    }
  }, [fetchDashboard]);

  const handleVersionRestore = (restoredDashboard: Dashboard) => {
    setDashboard(restoredDashboard);
    setPreviewingVersion(null); // Clear any preview
    setIsVersionHistoryOpen(false);
  };

  const handleVersionPreview = async (version: DashboardVersion | null) => {
    if (!version) {
      setPreviewingVersion(null);
      return;
    }

    // Get the HTML from the version's config
    const versionConfig = version.config as DashboardConfig | null;
    if (versionConfig?.html) {
      setPreviewingVersion({
        id: version.id,
        html: versionConfig.html,
        major: version.major_version,
        minor: version.minor_version,
      });
    } else {
      toast.error('Unable to preview this version');
    }
  };

  // Handler for when data refresh starts - trigger polling
  const handleDataRefreshStarted = useCallback(() => {
    // Optimistically set status to refreshing so polling starts
    setDashboard(prev => prev ? { ...prev, generation_status: 'refreshing' } : prev);
  }, []);

  const handleDataRefresh = async (result: { success: boolean; refreshed: boolean }) => {
    if (result.success) {
      // Refetch the dashboard to get the updated config
      const data = await fetchDashboard();
      if (data) {
        setDashboard(data.dashboard);
      }
    }
  };

  const handleDelete = async () => {
    if (!dashboard) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete dashboard');
      }

      toast.success('Dashboard moved to trash');
      router.push('/dashboards');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete dashboard');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleRetryGeneration = async () => {
    try {
      const response = await fetch(`/api/dashboards/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle insufficient credits (402)
        if (response.status === 402) {
          setCreditsInfo({
            needed: result.credits_required || 25,
            available: result.credits_available || 0,
          });
          setUpgradeModalOpen(true);
          return;
        }
        throw new Error(result.error || 'Failed to retry generation');
      }

      // Refetch to get updated status
      const data = await fetchDashboard();
      if (data) {
        setDashboard(data.dashboard);
      }
      toast.info('Retrying generation...');
    } catch (err) {
      console.error('Failed to retry generation:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to retry generation');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-gray-50)]">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-gray-50)]">
        <div className="text-center">
          <p className="text-[var(--color-error)] mb-4">{error || 'Dashboard not found'}</p>
          <Link href="/dashboards">
            <Button>Back to Dashboards</Button>
          </Link>
        </div>
      </div>
    );
  }

  const generationStatus = dashboard.generation_status as GenerationStatus;
  const isGenerating = generationStatus === 'pending' || generationStatus === 'analyzing' || generationStatus === 'generating';
  const isRefreshing = generationStatus === 'refreshing';
  const hasFailed = generationStatus === 'failed';
  // Dashboard is viewable if we have config and either:
  // - Status is completed, or
  // - We're refreshing (show existing while updating), or
  // - Failed but we have existing content (show with error banner)
  const isComplete = dashboard.config && (generationStatus === 'completed' || isRefreshing || hasFailed);

  const config = dashboard.config as DashboardConfig | null;
  const data = (dashboard.data as Record<string, unknown>[]) || [];

  return (
    <div style={brandingStyles}>
      {/* Version Preview Banner - Fixed at top */}
      {previewingVersion && (
        <div className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-2 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="text-sm font-medium">
                Previewing v{previewingVersion.major}.{previewingVersion.minor}
              </span>
            </div>
            <button
              onClick={() => setPreviewingVersion(null)}
              className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-md transition-colors"
            >
              Exit Preview
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Title Bar - Constrained width */}
      <div className="bg-white border-b border-[var(--color-gray-200)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 gap-4">
            {/* Left side - Back + Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link
                href="/dashboards"
                className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)] transition-colors"
                title="Back to dashboards"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>

              {/* Company Logo (from branding) */}
              {branding?.logoUrl && (
                <div className="flex-shrink-0 hidden sm:block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={branding.logoUrl}
                    alt={branding.companyName || 'Company logo'}
                    className="h-7 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Title */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-col">
                  <div className="group flex items-center gap-2">
                    {isEditingTitle ? (
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleTitleSave();
                          }
                          if (e.key === 'Escape') {
                            setIsEditingTitle(false);
                            setEditedTitle(dashboard.title);
                          }
                        }}
                        onBlur={() => {
                          // Save on blur if title changed, otherwise cancel
                          if (editedTitle.trim() && editedTitle.trim() !== dashboard.title) {
                            handleTitleSave();
                          } else {
                            setIsEditingTitle(false);
                            setEditedTitle(dashboard.title);
                          }
                        }}
                        autoFocus
                        className="text-2xl font-bold text-[var(--color-gray-900)] bg-transparent border-none outline-none p-0 m-0 w-full min-w-0 focus:ring-0"
                        style={{
                          fontFamily: 'inherit',
                          caretColor: 'var(--color-primary)',
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setIsEditingTitle(true)}
                        className="text-left min-w-0"
                        title="Click to edit title"
                      >
                        <h1 className="text-2xl font-bold text-[var(--color-gray-900)] truncate">
                          {dashboard.title}
                        </h1>
                      </button>
                    )}
                    <svg
                      className={`w-4 h-4 text-[var(--color-gray-400)] flex-shrink-0 transition-opacity ${
                        isEditingTitle ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  {isComplete && dashboard.updated_at && (
                    <span className="text-xs text-[var(--color-gray-500)]">
                      Updated {formatLastUpdated(dashboard.updated_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Generation Status Badge */}
              {isGenerating && (
                <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  {generationStatus === 'analyzing' ? 'Analyzing...' :
                   generationStatus === 'generating' ? 'Generating...' : 'Pending...'}
                </span>
              )}

              {/* Refreshing Status Badge */}
              {isRefreshing && (
                <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  Updating data...
                </span>
              )}
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Modify with AI Button */}
              {isComplete && (
                <ModifyWithAIModal
                  dashboardId={id}
                  isDisabled={!isComplete}
                  onModificationComplete={handleModificationComplete}
                />
              )}

              {/* Update Data Button */}
              {isComplete && !isRefreshing && (
                <UpdateDataModal
                  dashboardId={id}
                  hasGoogleConnection={Boolean(dashboard.google_connection_id)}
                  onRefreshStarted={handleDataRefreshStarted}
                  onRefreshComplete={handleDataRefresh}
                  trigger={
                    <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Update Data
                    </Button>
                  }
                />
              )}

              {/* Version History Button */}
              {isComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsVersionHistoryOpen(true)}
                  className="hidden md:flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  History
                </Button>
              )}

              {/* Share Button (includes visibility, sharing, and copy link) */}
              <ShareDialog
                dashboardId={id}
                dashboardSlug={dashboard.slug}
                isPublished={dashboard.is_published}
                onPublishChange={(isPublished) => {
                  setDashboard(prev => prev ? { ...prev, is_published: isPublished } : prev);
                }}
              />

              {/* More Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="px-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      const url = `${window.location.origin}/d/${dashboard.slug}`;
                      navigator.clipboard.writeText(url);
                      toast.success('Link copied to clipboard!');
                    }}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Dashboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Constrained width */}
      <main className="transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Generating State */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-white rounded-xl shadow-sm p-8">
              <div className="w-16 h-16 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-6" />
              <h2 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
                {generationStatus === 'analyzing' ? 'Analyzing your content...' :
                 generationStatus === 'generating' ? 'Designing your dashboard...' :
                 'Starting generation...'}
              </h2>
              <p className="text-[var(--color-gray-600)] max-w-md">
                {generationStatus === 'analyzing'
                  ? 'Our AI is analyzing your data to understand its structure and patterns.'
                  : generationStatus === 'generating'
                  ? 'Creating a beautiful, insightful dashboard based on your content.'
                  : 'Your dashboard generation will begin shortly.'}
              </p>
              <p className="text-sm text-[var(--color-gray-500)] mt-4">
                We&apos;ll email you when it&apos;s ready. Feel free to close this page.
              </p>
            </div>
          )}

          {/* Failed State - Full page (only when no existing dashboard) */}
          {hasFailed && !config && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-white rounded-xl shadow-sm p-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
                Generation Failed
              </h2>
              <p className="text-[var(--color-gray-600)] max-w-md mb-4">
                {dashboard.generation_error || 'Something went wrong while generating your dashboard.'}
              </p>
              <Button onClick={handleRetryGeneration}>
                Try Again
              </Button>
            </div>
          )}

          {/* Completed State - Render the dashboard */}
          {isComplete && config && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <PageRenderer
                html={previewingVersion?.html || config.html}
                charts={config.charts}
                data={data}
              />
            </div>
          )}

          {/* No config yet and not generating/failed */}
          {!isComplete && !isGenerating && !hasFailed && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-white rounded-xl shadow-sm p-8">
              <p className="text-[var(--color-gray-500)] mb-4">
                No content generated yet.
              </p>
              <Button onClick={handleRetryGeneration}>
                Generate Dashboard
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Version History Panel */}
      {isComplete && (
        <VersionHistoryPanel
          dashboardId={id}
          currentVersion={{
            major: dashboard.current_major_version || 1,
            minor: dashboard.current_minor_version || 0,
          }}
          isOpen={isVersionHistoryOpen}
          onClose={() => {
            setIsVersionHistoryOpen(false);
            setPreviewingVersion(null);
          }}
          onRestore={handleVersionRestore}
          onPreview={handleVersionPreview}
          previewingVersionId={previewingVersion?.id}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Dashboard</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{dashboard.title}&quot;? The dashboard will be moved to trash and can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal for insufficient credits */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        reason="credits"
        creditsNeeded={creditsInfo?.needed}
        creditsAvailable={creditsInfo?.available}
      />
    </div>
  );
}
