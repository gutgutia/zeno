import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils/format';
import type { Dashboard, Workspace } from '@/types/database';

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

export default async function DashboardsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's workspace
  const { data: workspaceData } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .eq('type', 'personal')
    .single();

  const workspace = workspaceData as Workspace | null;

  // Get dashboards (only if workspace exists)
  let dashboards: Dashboard[] = [];
  if (workspace?.id) {
    const { data } = await supabase
      .from('dashboards')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('updated_at', { ascending: false });
    dashboards = (data as Dashboard[]) || [];
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
            My Dashboards
          </h1>
          <p className="text-[var(--color-gray-600)] mt-1">
            Create and manage your data visualizations
          </p>
        </div>
        <Link href="/dashboards/new">
          <Button>+ New Dashboard</Button>
        </Link>
      </div>

      {/* Dashboard Grid or Empty State */}
      {!dashboards || dashboards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-[var(--color-gray-100)] rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8 text-[var(--color-gray-400)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
        No dashboards yet
      </h2>
      <p className="text-[var(--color-gray-600)] mb-6 max-w-sm mx-auto">
        Create your first dashboard by pasting data or uploading a file.
      </p>
      <Link href="/dashboards/new">
        <Button>Create Your First Dashboard</Button>
      </Link>
    </div>
  );
}

function DashboardCard({ dashboard }: { dashboard: Dashboard }) {
  const config = dashboard.config as { charts?: unknown[] };
  const chartCount = config?.charts?.length || 0;

  return (
    <Link
      href={`/dashboards/${dashboard.id}`}
      className="block bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm hover:shadow-md hover:border-[var(--color-gray-300)] transition-all p-6"
    >
      {/* Preview placeholder */}
      <div className="h-32 bg-[var(--color-gray-50)] rounded-lg mb-4 flex items-center justify-center">
        {chartCount > 0 ? (
          <span className="text-sm text-[var(--color-gray-500)]">
            {chartCount} chart{chartCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="text-sm text-[var(--color-gray-400)]">No charts yet</span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-[var(--color-gray-900)] mb-1 truncate">
        {dashboard.title}
      </h3>

      {/* Meta */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-gray-500)]">
        <span>{formatRelativeTime(dashboard.updated_at)}</span>
        {dashboard.is_published && (
          <>
            <span>•</span>
            <span className="text-[var(--color-success)]">Published</span>
          </>
        )}
      </div>
    </Link>
  );
}
