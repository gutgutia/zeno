import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import type { Dashboard, BrandingConfig, DashboardShare } from '@/types/database';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import Link from 'next/link';
import { PublicPageRenderer } from './PublicPageRenderer';
import { SharedDashboardAuthGate, AccessRevoked } from '@/components/dashboard/SharedDashboardAuthGate';

interface PageProps {
  params: Promise<{ slug: string }>;
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

// Access Denied component - for users signed in but without access
function AccessDenied({ userEmail, dashboardTitle }: { userEmail: string; dashboardTitle: string }) {
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
        <p className="text-[var(--color-gray-600)] mb-2">
          You don&apos;t have permission to view <span className="font-medium">&quot;{dashboardTitle}&quot;</span>.
        </p>
        <p className="text-sm text-[var(--color-gray-500)] mb-4">
          Signed in as <span className="font-medium">{userEmail}</span>
        </p>
        <p className="text-sm text-[var(--color-gray-500)] mb-6">
          Please contact the dashboard owner to request access.
        </p>
        <Link
          href="/dashboards"
          className="inline-flex items-center justify-center px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Go to My Dashboards
        </Link>
      </div>
    </div>
  );
}

// Generating state component
function GeneratingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-gray-50)]">
      <div className="text-center max-w-md px-4">
        <div className="w-16 h-16 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h1 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
          Dashboard is being generated
        </h1>
        <p className="text-[var(--color-gray-600)]">
          Please check back in a moment.
        </p>
      </div>
    </div>
  );
}

export default async function PublicDashboardPage({ params }: PageProps) {
  const { slug } = await params;

  // Use admin client to bypass RLS for fetching dashboard
  const adminSupabase = createAdminClient();

  // First, try to find the dashboard by slug (regardless of published status)
  const { data, error } = await adminSupabase
    .from('dashboards')
    .select('*, workspaces!inner(branding, owner_id)')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    notFound();
  }

  const dashboardData = data as Dashboard & {
    workspaces: { branding: BrandingConfig | null; owner_id: string };
  };

  // If published, allow access to anyone
  if (!dashboardData.is_published) {
    // Not published - check for share-based access
    const userSupabase = await createClient();
    const { data: { user } } = await userSupabase.auth.getUser();

    // Check if user is the owner
    const isOwner = user && dashboardData.workspaces.owner_id === user.id;

    if (!isOwner) {
      // Get shares for this dashboard
      const { data: shares } = await adminSupabase
        .from('dashboard_shares')
        .select('*')
        .eq('dashboard_id', dashboardData.id);

      const dashboardShares = (shares || []) as DashboardShare[];

      // If no shares exist, this is a private dashboard
      if (dashboardShares.length === 0) {
        notFound();
      }

      // If not authenticated, show auth gate with blurred placeholder
      if (!user) {
        return (
          <SharedDashboardAuthGate
            dashboardTitle={dashboardData.title}
            slug={slug}
          />
        );
      }

      // Check if user's email matches any share
      const hasAccess = checkShareAccess(dashboardShares, user.email || '');

      if (!hasAccess) {
        // User is authenticated but doesn't have access (access may have been revoked)
        return <AccessDenied userEmail={user.email || ''} dashboardTitle={dashboardData.title} />;
      }
    }
  }

  const dashboard = dashboardData;
  const config = dashboard.config as DashboardConfig | null;
  const chartData = (dashboard.data as Record<string, unknown>[]) || [];

  // Check generation status
  if (dashboard.generation_status !== 'completed' || !config) {
    return <GeneratingState />;
  }

  // Merge workspace branding with dashboard override
  const branding = getMergedBranding(
    dashboardData.workspaces.branding,
    dashboard.branding_override
  );

  // Compute inline styles from branding
  const brandingStyles: React.CSSProperties = {
    ...(branding.colors?.background && { backgroundColor: branding.colors.background }),
  };

  return (
    <div className="min-h-screen" style={brandingStyles}>
      {/* Render the page content */}
      <PublicPageRenderer
        html={config.html}
        charts={config.charts}
        data={chartData}
        branding={branding}
        title={dashboard.title}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-[var(--color-gray-200)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-[var(--color-gray-500)] text-center">
            Created with{' '}
            <a href="https://zeno.fyi" className="text-[var(--color-primary)] hover:underline">
              Zeno
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
