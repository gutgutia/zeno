import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import type { Metadata } from 'next';
import type { Dashboard, BrandingConfig, DashboardShare, ExternalViewerSession, Organization } from '@/types/database';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import Link from 'next/link';
import { SharedDashboardHeader } from '@/components/layout/shared-dashboard-header';
import { DashboardTitleBar } from '@/components/dashboard/DashboardTitleBar';
import { PageRenderer } from '@/components/dashboard/PageRenderer';
import { SharedDashboardAuthGate } from '@/components/dashboard/SharedDashboardAuthGate';

// Cookie name for external viewer sessions
const EXTERNAL_SESSION_COOKIE = 'zeno_external_session';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate dynamic metadata for public dashboards
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = 'https://zeno.fyi';

  try {
    const adminSupabase = createAdminClient();

    const { data: dashboard } = await adminSupabase
      .from('dashboards')
      .select('title, description, is_published')
      .eq('slug', slug)
      .single();

    if (!dashboard) {
      return {
        title: 'Dashboard Not Found | Zeno',
        description: 'This dashboard could not be found.',
      };
    }

    const title = dashboard.title || 'Dashboard';
    const description = dashboard.description || `View the ${title} dashboard on Zeno - AI-powered data visualization.`;

    return {
      title: `${title} | Zeno`,
      description,
      openGraph: {
        title: `${title} | Zeno`,
        description,
        url: `${baseUrl}/d/${slug}`,
        siteName: 'Zeno',
        type: 'website',
        images: [
          {
            url: `${baseUrl}/social/og-image.png`,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${title} | Zeno`,
        description,
        images: [`${baseUrl}/social/og-image.png`],
      },
      // Only allow indexing for published dashboards
      robots: dashboard.is_published
        ? { index: true, follow: true }
        : { index: false, follow: false },
    };
  } catch {
    return {
      title: 'Dashboard | Zeno',
      description: 'View this dashboard on Zeno - AI-powered data visualization.',
    };
  }
}

// Check for valid external viewer session
async function checkExternalViewerSession(
  supabase: ReturnType<typeof createAdminClient>,
  dashboardId: string
): Promise<{ valid: boolean; email?: string }> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(EXTERNAL_SESSION_COOKIE);

  if (!sessionCookie) {
    return { valid: false };
  }

  try {
    const { token, dashboardId: cookieDashboardId } = JSON.parse(decodeURIComponent(sessionCookie.value));

    // Ensure the cookie is for this dashboard
    if (cookieDashboardId !== dashboardId) {
      return { valid: false };
    }

    // Hash the token to look up the session
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find the session
    const { data: session, error } = await supabase
      .from('external_viewer_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('dashboard_id', dashboardId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session) {
      return { valid: false };
    }

    const sessionData = session as ExternalViewerSession;

    // Update last accessed time (fire and forget)
    supabase
      .from('external_viewer_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', sessionData.id)
      .then(() => {});

    return { valid: true, email: sessionData.email };
  } catch {
    return { valid: false };
  }
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

  // Fetch organization white-label settings if dashboard belongs to an org
  let orgWhiteLabel: {
    white_label_enabled: boolean;
    branding: BrandingConfig | null;
  } | null = null;

  if (dashboardData.organization_id) {
    const { data: orgData } = await adminSupabase
      .from('organizations')
      .select('white_label_enabled, branding')
      .eq('id', dashboardData.organization_id)
      .single();

    if (orgData) {
      orgWhiteLabel = orgData as { white_label_enabled: boolean; branding: BrandingConfig | null };
    }
  }

  // Get the user client for auth checks
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  // If published, allow access to anyone
  if (!dashboardData.is_published) {
    // Not published - check for ownership or share-based access

    // Check if user is the owner
    const isOwner = user && dashboardData.workspaces.owner_id === user.id;

    if (!isOwner) {
      // Not the owner (or not logged in) - check shares and auth

      // Get shares for this dashboard
      const { data: shares } = await adminSupabase
        .from('dashboard_shares')
        .select('*')
        .eq('dashboard_id', dashboardData.id);

      const dashboardShares = (shares || []) as DashboardShare[];

      // Check for Supabase authenticated user
      let hasAccess = false;
      let viewerEmail = '';

      if (user) {
        // Supabase authenticated user - check if they have share access
        hasAccess = checkShareAccess(dashboardShares, user.email || '');
        viewerEmail = user.email || '';
      } else {
        // Check for external viewer session (cookie-based)
        const externalSession = await checkExternalViewerSession(adminSupabase, dashboardData.id);
        if (externalSession.valid && externalSession.email) {
          // Verify the session email still has access (or is the owner)
          const isExternalOwner = false; // External sessions can't be owners (they'd use Supabase auth)
          hasAccess = isExternalOwner || checkShareAccess(dashboardShares, externalSession.email);
          viewerEmail = externalSession.email;
        }
      }

      // If not authenticated at all, show auth gate so they can log in
      // (They might be the owner who just isn't logged in yet)
      if (!user && !viewerEmail) {
        // Pass white-label info if enabled
        const whiteLabelProps = orgWhiteLabel?.white_label_enabled ? {
          companyName: orgWhiteLabel.branding?.companyName,
        } : undefined;

        return (
          <SharedDashboardAuthGate
            dashboardTitle={dashboardData.title}
            slug={slug}
            dashboardId={dashboardData.id}
            whiteLabel={whiteLabelProps}
          />
        );
      }

      // User/viewer is authenticated but doesn't have access
      // (They're not the owner and not in the share list)
      if (!hasAccess) {
        return <AccessDenied userEmail={viewerEmail} dashboardTitle={dashboardData.title} />;
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

  // User object for header (null if not logged in)
  const headerUser = user ? { email: user.email || '' } : null;

  // Last updated time (prefer updated_at, fall back to created_at)
  const lastUpdated = dashboard.updated_at || dashboard.created_at;

  // Compute branding styles
  const brandingStyles: React.CSSProperties = {
    '--brand-primary': branding.colors?.primary,
    '--brand-secondary': branding.colors?.secondary,
    '--brand-accent': branding.colors?.accent,
    '--brand-background': branding.colors?.background,
  } as React.CSSProperties;

  // Check if white-labeling is enabled
  const isWhiteLabeled = orgWhiteLabel?.white_label_enabled ?? false;

  return (
    <div className="min-h-screen bg-[var(--color-gray-50)]" style={brandingStyles}>
      {/* Top nav bar - same as owner view */}
      <SharedDashboardHeader user={headerUser} hideZenoBranding={isWhiteLabeled} />

      {/* Title bar - same as owner view, without action buttons */}
      <DashboardTitleBar
        title={dashboard.title}
        branding={branding}
        lastUpdated={lastUpdated}
        backUrl="/dashboards"
        showBackButton={!!user}
      />

      {/* Main content - same structure as owner view */}
      <main className="transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <PageRenderer
              html={config.html}
              charts={config.charts}
              data={chartData}
            />
          </div>
        </div>
      </main>

      {/* Footer - hidden for white-labeled dashboards */}
      {!isWhiteLabeled && (
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
      )}
    </div>
  );
}
