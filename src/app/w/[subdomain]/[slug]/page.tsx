import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound, redirect } from 'next/navigation';
import type { Dashboard, BrandingConfig, DashboardShare, Organization } from '@/types/database';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import Link from 'next/link';
import { WorkspacePageRenderer } from './WorkspacePageRenderer';
import type { Metadata } from 'next';

// Type for organization fields we need
type OrgFields = Pick<Organization, 'id' | 'subdomain' | 'branding' | 'created_by' | 'name' | 'white_label_enabled' | 'favicon_url'>;

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

export default async function OrganizationDashboardPage({ params }: PageProps) {
  const { subdomain, slug } = await params;

  const adminSupabase = createAdminClient();

  // First, verify the organization exists
  const { data: organization, error: organizationError } = await adminSupabase
    .from('organizations')
    .select('id, subdomain, branding, created_by, name, white_label_enabled, favicon_url')
    .eq('subdomain', subdomain)
    .single();

  if (organizationError || !organization) {
    notFound();
  }

  const typedOrganization = organization as OrgFields;

  // Find the dashboard by slug within this organization
  const { data, error } = await adminSupabase
    .from('dashboards')
    .select('*')
    .eq('organization_id', typedOrganization.id)
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

    // Check if user is the organization owner or a member
    let isOwner = user && typedOrganization.created_by === user.id;

    // Also check if user is a member of the organization
    if (user && !isOwner) {
      const { data: membership } = await adminSupabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', typedOrganization.id)
        .eq('user_id', user.id)
        .single();

      if (membership) {
        isOwner = true; // Any org member can view unpublished dashboards
      }
    }

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
        redirect(`/auth?redirect=/${slug}`);
      }

      // Check if user's email matches any share
      const hasAccess = checkShareAccess(dashboardShares, user.email || '');

      if (!hasAccess) {
        return <AccessDenied userEmail={user.email || ''} subdomain={subdomain} />;
      }
    }
  }

  const config = dashboard.config as DashboardConfig | null;
  const chartData = (dashboard.data as Record<string, unknown>[]) || [];

  // Check generation status
  if (dashboard.generation_status !== 'completed' || !config) {
    return <GeneratingState />;
  }

  // Merge organization branding with dashboard override
  const branding = getMergedBranding(
    typedOrganization.branding,
    dashboard.branding_override
  );

  // Compute inline styles from branding
  const brandingStyles: React.CSSProperties = {
    ...(branding.colors?.background && { backgroundColor: branding.colors.background }),
  };

  // White-label settings
  const showPoweredBy = !typedOrganization.white_label_enabled;
  const companyName = branding.companyName || typedOrganization.name || 'Dashboard';
  const pageTitle = typedOrganization.white_label_enabled
    ? `${dashboard.title} | ${companyName}`
    : `${dashboard.title} | ${companyName} - Zeno`;

  return (
    <>
      {/* Dynamic head content */}
      <title>{pageTitle}</title>
      {typedOrganization.white_label_enabled && typedOrganization.favicon_url && (
        <link rel="icon" href={typedOrganization.favicon_url} />
      )}

      <div className="min-h-screen" style={brandingStyles}>
        {/* Render the page content */}
        <WorkspacePageRenderer
          html={config.html}
          charts={config.charts}
          data={chartData}
          branding={branding}
          title={dashboard.title}
          subdomain={subdomain}
        />

        {/* Footer - conditionally shown based on white-label settings */}
        {showPoweredBy && (
          <footer className="bg-white border-t border-[var(--color-gray-200)] mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <p className="text-sm text-[var(--color-gray-500)] text-center">
                Powered by{' '}
                <a href="https://zeno.fyi" className="text-[var(--color-primary)] hover:underline">
                  Zeno
                </a>
              </p>
            </div>
          </footer>
        )}
      </div>
    </>
  );
}
