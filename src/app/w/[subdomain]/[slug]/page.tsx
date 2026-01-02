import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound, redirect } from 'next/navigation';
import { ChartRenderer } from '@/components/charts';
import type { Dashboard, BrandingConfig, DashboardShare, Workspace } from '@/types/database';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { ChartConfig } from '@/types/chart';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ subdomain: string; slug: string }>;
}

export const dynamic = 'force-dynamic';

// Check if user has access to a shared dashboard
function checkShareAccess(shares: DashboardShare[], userEmail: string): boolean {
  const email = userEmail.toLowerCase();
  const domain = email.split('@')[1];

  return shares.some((share) => {
    if (share.share_type === 'email') {
      return share.share_value === email;
    } else if (share.share_type === 'domain') {
      return share.share_value === domain;
    }
    return false;
  });
}

// Access Denied component
function AccessDenied({ userEmail, subdomain }: { userEmail: string; subdomain: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-gray-50)]">
      <div className="text-center max-w-md px-4">
        <div className="w-16 h-16 bg-[var(--color-gray-100)] rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
          Access Denied
        </h1>
        <p className="text-[var(--color-gray-600)] mb-4">
          You don&apos;t have permission to view this dashboard.
        </p>
        <p className="text-sm text-[var(--color-gray-500)] mb-6">
          Signed in as <span className="font-medium">{userEmail}</span>
        </p>
        <Link
          href={`/`}
          className="inline-flex items-center justify-center px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Back to {subdomain}
        </Link>
      </div>
    </div>
  );
}

export default async function WorkspaceDashboardPage({ params }: PageProps) {
  const { subdomain, slug } = await params;

  const adminSupabase = createAdminClient();

  // First, verify the workspace exists
  const { data: workspace, error: workspaceError } = await adminSupabase
    .from('workspaces')
    .select('id, subdomain, branding, owner_id')
    .eq('subdomain', subdomain)
    .single();

  if (workspaceError || !workspace) {
    notFound();
  }

  const typedWorkspace = workspace as Pick<Workspace, 'id' | 'subdomain' | 'branding' | 'owner_id'>;

  // Find the dashboard by slug within this workspace
  const { data, error } = await adminSupabase
    .from('dashboards')
    .select('*')
    .eq('workspace_id', typedWorkspace.id)
    .eq('slug', slug)
    .single();

  if (error || !data) {
    notFound();
  }

  const dashboard = data as Dashboard;

  // If not published, check for share-based access
  if (!dashboard.is_published) {
    const userSupabase = await createClient();
    const { data: { user } } = await userSupabase.auth.getUser();

    // Check if user is the owner
    const isOwner = user && typedWorkspace.owner_id === user.id;

    if (!isOwner) {
      // Get shares for this dashboard
      const { data: shares } = await adminSupabase
        .from('dashboard_shares')
        .select('*')
        .eq('dashboard_id', dashboard.id);

      const dashboardShares = (shares || []) as DashboardShare[];

      // If no shares exist, this is a private dashboard
      if (dashboardShares.length === 0) {
        notFound();
      }

      // If not authenticated, redirect to login
      if (!user) {
        redirect(`/login?redirect=/${slug}`);
      }

      // Check if user's email matches any share
      const hasAccess = checkShareAccess(dashboardShares, user.email || '');

      if (!hasAccess) {
        return <AccessDenied userEmail={user.email || ''} subdomain={subdomain} />;
      }
    }
  }

  const config = dashboard.config as DashboardConfig;
  const chartData = (dashboard.data as Record<string, unknown>[]) || [];
  const charts = config.charts || [];

  // Merge workspace branding with dashboard override
  const branding = getMergedBranding(
    typedWorkspace.branding,
    dashboard.branding_override
  );

  // Separate number cards from other charts for layout
  const numberCards = charts.filter((c: ChartConfig) => c.type === 'number_card');
  const otherCharts = charts.filter((c: ChartConfig) => c.type !== 'number_card');

  // Compute inline styles from branding
  const brandingStyles: React.CSSProperties = {
    ...(branding.colors?.background && { backgroundColor: branding.colors.background }),
  };

  return (
    <div className="min-h-screen" style={brandingStyles}>
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-gray-200)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Company Logo */}
              {branding.logoUrl ? (
                <Link href="/">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={branding.logoUrl}
                    alt={branding.companyName || 'Company logo'}
                    className="h-10 object-contain"
                  />
                </Link>
              ) : (
                <Link href="/" className="text-[var(--color-primary)] hover:opacity-80">
                  {branding.companyName || subdomain}
                </Link>
              )}
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
                  {config.title || dashboard.title}
                </h1>
                {config.description && (
                  <p className="text-[var(--color-gray-600)] mt-1">{config.description}</p>
                )}
              </div>
            </div>

            {/* Back to workspace link */}
            <Link
              href="/"
              className="text-sm text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]"
            >
              View all dashboards
            </Link>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {charts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--color-gray-500)]">
              This dashboard has no charts yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Number Cards Row */}
            {numberCards.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {numberCards.map((chart: ChartConfig) => (
                  <ChartRenderer key={chart.id} config={chart} data={chartData} />
                ))}
              </div>
            )}

            {/* Other Charts Grid */}
            {otherCharts.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {otherCharts.map((chart: ChartConfig) => (
                  <ChartRenderer key={chart.id} config={chart} data={chartData} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[var(--color-gray-200)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-[var(--color-gray-500)] text-center">
            Powered by{' '}
            <a href="https://zeno.app" className="text-[var(--color-primary)] hover:underline">
              Zeno
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
