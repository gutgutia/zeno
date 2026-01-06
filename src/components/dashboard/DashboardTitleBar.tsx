'use client';

import Link from 'next/link';
import type { BrandingConfig } from '@/types/database';

interface DashboardTitleBarProps {
  title: string;
  branding?: BrandingConfig | null;
  /** Last updated or created timestamp */
  lastUpdated?: string | Date;
  /** Back link URL - defaults to /dashboards */
  backUrl?: string;
  /** Whether to show the back button */
  showBackButton?: boolean;
  /** Children rendered on the right side (action buttons) */
  children?: React.ReactNode;
}

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

/**
 * DashboardTitleBar - Consistent title bar for dashboard views
 *
 * Used in both owner view and shared/public views.
 * For shared views, simply don't pass children (action buttons).
 */
export function DashboardTitleBar({
  title,
  branding,
  lastUpdated,
  backUrl = '/dashboards',
  showBackButton = true,
  children,
}: DashboardTitleBarProps) {
  return (
    <div className="bg-white border-b border-[var(--color-gray-200)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-4 gap-4">
          {/* Left side - Back + Logo + Title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {showBackButton && (
              <Link
                href={backUrl}
                className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)] transition-colors"
                title="Back to dashboards"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            )}

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
                <h1 className="text-lg font-semibold text-[var(--color-gray-900)] truncate">
                  {title}
                </h1>
                {lastUpdated && (
                  <span className="text-xs text-[var(--color-gray-500)]">
                    Updated {formatLastUpdated(lastUpdated)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Action buttons (optional) */}
          {children && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
