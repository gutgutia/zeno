'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { Dashboard, DashboardVersion, VersionChangeType } from '@/types/database';
import { toast } from 'sonner';

interface VersionHistoryPanelProps {
  dashboardId: string;
  currentVersion: {
    major: number;
    minor: number;
  };
  isOpen: boolean;
  onClose: () => void;
  onRestore: (dashboard: Dashboard) => void;
  onPreview?: (version: DashboardVersion | null) => void;
  previewingVersionId?: string | null;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getChangeTypeInfo(changeType: VersionChangeType): { label: string; color: string; icon: React.ReactNode } {
  switch (changeType) {
    case 'initial':
      return {
        label: 'Created',
        color: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        ),
      };
    case 'ai_modification':
      return {
        label: 'AI Edit',
        color: 'bg-purple-100 text-purple-700',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        ),
      };
    case 'data_refresh':
      return {
        label: 'Data Update',
        color: 'bg-blue-100 text-blue-700',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
      };
    case 'restore':
      return {
        label: 'Restored',
        color: 'bg-amber-100 text-amber-700',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    default:
      return {
        label: 'Change',
        color: 'bg-gray-100 text-gray-700',
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
      };
  }
}

export function VersionHistoryPanel({
  dashboardId,
  currentVersion,
  isOpen,
  onClose,
  onRestore,
  onPreview,
  previewingVersionId,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DashboardVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchVersions() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/dashboards/${dashboardId}/versions`);
        if (!response.ok) {
          throw new Error('Failed to fetch versions');
        }
        const data = await response.json();
        setVersions(data.versions);
      } catch (error) {
        console.error('Failed to fetch versions:', error);
        toast.error('Failed to load version history');
      } finally {
        setIsLoading(false);
      }
    }

    fetchVersions();
  }, [dashboardId, isOpen]);

  const handleRestore = async (version: DashboardVersion) => {
    const versionLabel = `${version.major_version}.${version.minor_version}`;
    setIsRestoring(version.id);

    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          major: version.major_version,
          minor: version.minor_version,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to restore version');
      }

      const result = await response.json();
      toast.success(`Restored to version ${versionLabel}`);
      onRestore(result.dashboard);

      // Refresh the versions list to show the new restore entry
      const versionsResponse = await fetch(`/api/dashboards/${dashboardId}/versions`);
      if (versionsResponse.ok) {
        const data = await versionsResponse.json();
        setVersions(data.versions);
      }
    } catch (error) {
      console.error('Failed to restore version:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to restore version');
    } finally {
      setIsRestoring(null);
    }
  };

  const isCurrentVersion = (version: DashboardVersion) =>
    version.major_version === currentVersion.major &&
    version.minor_version === currentVersion.minor;

  return (
    <>
      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white border-l border-[var(--color-gray-200)] shadow-xl flex flex-col z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-gray-200)] bg-[var(--color-gray-50)]">
          <div>
            <h2 className="font-semibold text-[var(--color-gray-900)]">Version History</h2>
            <p className="text-sm text-[var(--color-gray-500)]">
              Current: v{currentVersion.major}.{currentVersion.minor}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)] hover:bg-[var(--color-gray-200)] transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 bg-[var(--color-gray-100)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[var(--color-gray-600)] font-medium">No version history</p>
              <p className="text-sm text-[var(--color-gray-500)] mt-1">
                Versions will appear here as you make changes
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-gray-100)]">
              {versions.map((version) => {
                const isCurrent = isCurrentVersion(version);
                const typeInfo = getChangeTypeInfo(version.change_type);
                const versionLabel = `${version.major_version}.${version.minor_version}`;

                const isPreviewing = previewingVersionId === version.id;

                return (
                  <div
                    key={version.id}
                    className={`p-4 transition-colors ${
                      isPreviewing
                        ? 'bg-[var(--color-primary)]/10 border-l-2 border-[var(--color-primary)]'
                        : isCurrent
                        ? 'bg-[var(--color-primary)]/5'
                        : 'hover:bg-[var(--color-gray-50)] cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isCurrent && onPreview) {
                        if (isPreviewing) {
                          onPreview(null); // Exit preview
                        } else {
                          onPreview(version);
                        }
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Version number and badge */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-[var(--color-gray-900)]">
                            v{versionLabel}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded">
                              Current
                            </span>
                          )}
                          {isPreviewing && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500 text-white rounded">
                              Previewing
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded ${typeInfo.color}`}>
                            {typeInfo.icon}
                            {typeInfo.label}
                          </span>
                        </div>

                        {/* Change summary */}
                        <p className="text-sm text-[var(--color-gray-600)] line-clamp-2">
                          {version.change_summary || 'No description'}
                        </p>

                        {/* Timestamp */}
                        <p className="text-xs text-[var(--color-gray-400)] mt-1">
                          {formatTimeAgo(version.created_at)}
                        </p>
                      </div>

                      {/* Restore button */}
                      {!isCurrent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card click
                            handleRestore(version);
                          }}
                          disabled={isRestoring !== null}
                          className="flex-shrink-0"
                        >
                          {isRestoring === version.id ? (
                            <div className="w-4 h-4 border-2 border-[var(--color-gray-400)] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            'Restore'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-gray-200)] bg-[var(--color-gray-50)]">
          <p className="text-xs text-[var(--color-gray-500)] text-center">
            Major versions (X.0) are created when data changes.
            Minor versions (X.Y) are created when you modify with AI.
          </p>
        </div>
      </div>

      {/* Overlay when panel is open on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
