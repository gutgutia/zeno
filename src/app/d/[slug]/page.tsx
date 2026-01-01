import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { ChartRenderer } from '@/components/charts';
import type { Dashboard, BrandingConfig } from '@/types/database';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { ChartConfig } from '@/types/chart';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PublicDashboardPage({ params }: PageProps) {
  const { slug } = await params;

  // Use admin client to bypass RLS for public read-only access
  // This avoids RLS recursion issues between dashboards and workspaces
  const supabase = createAdminClient();

  // Fetch the published dashboard by slug with workspace branding
  const { data, error } = await supabase
    .from('dashboards')
    .select('*, workspaces!inner(branding)')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !data) {
    notFound();
  }

  const dashboardData = data as Dashboard & {
    workspaces: { branding: BrandingConfig | null };
  };
  const dashboard = dashboardData;
  const config = dashboard.config as DashboardConfig;
  const chartData = (dashboard.data as Record<string, unknown>[]) || [];
  const charts = config.charts || [];

  // Merge workspace branding with dashboard override
  const branding = getMergedBranding(
    dashboardData.workspaces.branding,
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
          <div className="flex items-center gap-4">
            {/* Company Logo */}
            {branding.logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={branding.logoUrl}
                alt={branding.companyName || 'Company logo'}
                className="h-10 object-contain"
              />
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
            Created with{' '}
            <a href="/" className="text-[var(--color-primary)] hover:underline">
              Zeno
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
