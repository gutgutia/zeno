import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils/format';
import type { Dashboard, Workspace } from '@/types/database';

// Force dynamic rendering - this page requires authentication
export const dynamic = 'force-dynamic';

// Extended dashboard type with share count
interface DashboardWithShares extends Dashboard {
  share_count: number;
}

// Sharing status types
type SharingStatus = 'private' | 'public' | 'shared';

function getSharingStatus(dashboard: DashboardWithShares): SharingStatus {
  if (!dashboard.is_published) return 'private';
  if (dashboard.share_count > 0) return 'shared';
  return 'public';
}

const SHARING_STATUS_CONFIG: Record<SharingStatus, { label: string; icon: React.ReactNode; className: string }> = {
  private: {
    label: 'Private',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    className: 'text-[var(--color-gray-500)] bg-[var(--color-gray-100)]',
  },
  public: {
    label: 'Public',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    className: 'text-[var(--color-primary)] bg-[var(--color-primary-light)]',
  },
  shared: {
    label: 'Shared',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
    className: 'text-[var(--color-accent)] bg-[var(--color-accent-light)]',
  },
};

export default async function DashboardsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  // Get user's workspace
  const { data: workspaceData } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .eq('type', 'personal')
    .single();

  const workspace = workspaceData as Workspace | null;

  // Get dashboards with share counts (only if workspace exists)
  let dashboards: DashboardWithShares[] = [];
  if (workspace?.id) {
    // First get dashboards
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dashboardData } = await (supabase as any)
      .from('dashboards')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('updated_at', { ascending: false }) as { data: Dashboard[] | null };

    if (dashboardData) {
      // Get share counts for all dashboards
      const dashboardIds = dashboardData.map(d => d.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: shareData } = await (supabase as any)
        .from('dashboard_shares')
        .select('dashboard_id')
        .in('dashboard_id', dashboardIds) as { data: { dashboard_id: string }[] | null };

      // Count shares per dashboard
      const shareCounts = new Map<string, number>();
      shareData?.forEach(share => {
        const count = shareCounts.get(share.dashboard_id) || 0;
        shareCounts.set(share.dashboard_id, count + 1);
      });

      dashboards = dashboardData.map(d => ({
        ...d,
        share_count: shareCounts.get(d.id) || 0,
      })) as DashboardWithShares[];
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Dashboard Grid or Empty State */}
      {!dashboards || dashboards.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Header - only show when dashboards exist */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
                My Dashboards
              </h1>
              <p className="text-[var(--color-gray-600)] mt-1">
                Create and manage your data visualizations
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboards/shared"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Shared with me
              </Link>
              <Link
                href="/dashboards/trash"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Trash
              </Link>
              <Link href="/dashboards/new">
                <Button>+ New Dashboard</Button>
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboards.map((dashboard) => (
              <DashboardCard key={dashboard.id} dashboard={dashboard} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[var(--color-primary-light)] rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-[var(--color-accent-light)] rounded-full blur-3xl opacity-30" />
      </div>
      
      <div className="relative z-10 text-center max-w-lg">
        {/* Icon with Zeno blue background */}
        <div className="w-20 h-20 bg-[#0055FF] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
        </div>
        
        {/* Headline */}
        <h2 className="text-2xl font-bold text-[var(--color-gray-900)] mb-3">
          Create something beautiful
        </h2>
        
        {/* Subheadline */}
        <p className="text-[var(--color-gray-600)] mb-8 text-lg leading-relaxed">
          Paste your spreadsheet data and watch it transform into a stunning, shareable dashboard in seconds.
        </p>
        
        {/* CTA */}
        <Link href="/dashboards/new">
          <Button size="lg" className="px-8 py-3 text-base">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Dashboard
          </Button>
        </Link>
        
        {/* Trust signal */}
        <p className="mt-6 text-sm text-[var(--color-gray-500)]">
          100 free credits included · No credit card required
        </p>
      </div>
    </div>
  );
}

function DashboardCard({ dashboard }: { dashboard: DashboardWithShares }) {
  const sharingStatus = getSharingStatus(dashboard);
  const statusConfig = SHARING_STATUS_CONFIG[sharingStatus];

  return (
    <Link
      href={`/dashboards/${dashboard.id}`}
      className="group block bg-white rounded-xl border border-[var(--color-gray-200)] hover:border-[var(--color-gray-300)] hover:shadow-md transition-all overflow-hidden"
    >
      <div className="p-5">
        {/* Header: Title + Status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-[var(--color-gray-900)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">
            {dashboard.title}
          </h3>
          
          {/* Sharing status badge */}
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}>
            {statusConfig.icon}
            {statusConfig.label}
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
          <span>Updated {formatRelativeTime(dashboard.updated_at)}</span>
        </div>
      </div>
    </Link>
  );
}
