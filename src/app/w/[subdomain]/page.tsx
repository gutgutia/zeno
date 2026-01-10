import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Dashboard, BrandingConfig, Organization } from '@/types/database';

interface PageProps {
  params: Promise<{ subdomain: string }>;
}

export const dynamic = 'force-dynamic';

export default async function OrganizationHomePage({ params }: PageProps) {
  const { subdomain } = await params;

  const adminSupabase = createAdminClient();

  // Look up organization by subdomain
  const { data: organization, error: organizationError } = await adminSupabase
    .from('organizations')
    .select('*')
    .eq('subdomain', subdomain)
    .single();

  if (organizationError || !organization) {
    notFound();
  }

  const typedOrganization = organization as Organization;
  const branding = typedOrganization.branding as BrandingConfig | null;

  // Get all published dashboards for this organization
  const { data: dashboards } = await adminSupabase
    .from('dashboards')
    .select('id, title, slug, description, config, is_published, created_at')
    .eq('organization_id', typedOrganization.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  const publishedDashboards = (dashboards || []) as Pick<
    Dashboard,
    'id' | 'title' | 'slug' | 'description' | 'config' | 'is_published' | 'created_at'
  >[];

  // Brand styles
  const brandStyles: React.CSSProperties = {
    ...(branding?.colors?.background && { backgroundColor: branding.colors.background }),
  };

  return (
    <div className="min-h-screen" style={brandStyles}>
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-gray-200)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            {branding?.logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={branding.logoUrl}
                alt={branding.companyName || 'Company logo'}
                className="h-10 object-contain"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
                {branding?.companyName || typedOrganization.name}
              </h1>
              <p className="text-[var(--color-gray-600)] mt-1">
                Dashboards
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {publishedDashboards.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-[var(--color-gray-100)] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-[var(--color-gray-500)]">
              No public dashboards available yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publishedDashboards.map((dashboard) => (
              <Link
                key={dashboard.id}
                href={`/${dashboard.slug}`}
                className="block bg-white rounded-xl border border-[var(--color-gray-200)] p-6 hover:shadow-lg transition-shadow"
              >
                <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
                  {dashboard.title}
                </h2>
                {dashboard.description && (
                  <p className="text-sm text-[var(--color-gray-600)] line-clamp-2">
                    {dashboard.description}
                  </p>
                )}
                <div className="mt-4 flex items-center text-sm text-[var(--color-gray-500)]">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(dashboard.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
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
