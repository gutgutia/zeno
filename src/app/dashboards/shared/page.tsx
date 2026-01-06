'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { formatRelativeTime } from '@/lib/utils/format';

interface SharedDashboard {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  is_published: boolean;
  updated_at: string;
  created_at: string;
  shared_at: string;
}

export default function SharedWithMePage() {
  const [dashboards, setDashboards] = useState<SharedDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSharedDashboards();
  }, []);

  async function fetchSharedDashboards() {
    try {
      const response = await fetch('/api/dashboards/shared');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch shared dashboards');
      }

      setDashboards(data.dashboards);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 bg-[var(--color-gray-100)] rounded w-48 mb-2 animate-pulse" />
          <div className="h-4 bg-[var(--color-gray-100)] rounded w-72 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--color-gray-200)] p-5 animate-pulse">
              <div className="h-5 bg-[var(--color-gray-100)] rounded w-3/4 mb-3" />
              <div className="h-4 bg-[var(--color-gray-100)] rounded w-full mb-2" />
              <div className="h-4 bg-[var(--color-gray-100)] rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-[var(--color-gray-600)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <DashboardNav active="shared" showNewButton={false} />
        <p className="text-[var(--color-gray-600)] mt-1">
          Dashboards that others have shared with you
        </p>
      </div>

      {/* Dashboard Grid or Empty State */}
      {dashboards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((dashboard) => (
            <DashboardCard key={dashboard.id} dashboard={dashboard} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 bg-[var(--color-gray-100)] rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
        No shared dashboards yet
      </h2>
      <p className="text-[var(--color-gray-600)] text-center max-w-md">
        When someone shares a dashboard with you, it will appear here. You&apos;ll receive an email notification when a dashboard is shared.
      </p>
    </div>
  );
}

function DashboardCard({ dashboard }: { dashboard: SharedDashboard }) {
  return (
    <Link
      href={`/d/${dashboard.slug}`}
      className="group block bg-white rounded-xl border border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)] hover:shadow-md transition-all overflow-hidden"
    >
      <div className="p-5">
        {/* Header: Title + Shared badge */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-[var(--color-gray-900)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">
            {dashboard.title}
          </h3>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-[var(--color-teal)] bg-[var(--color-teal-light)]">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Shared
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-[var(--color-gray-600)] line-clamp-2 mb-4 min-h-[40px]">
          {dashboard.description || (
            <span className="text-[var(--color-gray-400)] italic">No description</span>
          )}
        </p>

        {/* Footer: Meta info */}
        <div className="text-xs text-[var(--color-gray-500)]">
          <span>Shared {formatRelativeTime(dashboard.shared_at)}</span>
        </div>
      </div>
    </Link>
  );
}
