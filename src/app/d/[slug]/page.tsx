import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ChartRenderer } from '@/components/charts';
import type { Dashboard } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { ChartConfig } from '@/types/chart';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PublicDashboardPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch the published dashboard by slug
  const { data, error } = await supabase
    .from('dashboards')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !data) {
    notFound();
  }

  const dashboard = data as Dashboard;
  const config = dashboard.config as DashboardConfig;
  const dashboardData = (dashboard.data as Record<string, unknown>[]) || [];
  const charts = config.charts || [];

  // Separate number cards from other charts for layout
  const numberCards = charts.filter((c: ChartConfig) => c.type === 'number_card');
  const otherCharts = charts.filter((c: ChartConfig) => c.type !== 'number_card');

  return (
    <div className="min-h-screen bg-[var(--color-gray-50)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-gray-200)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
            {config.title || dashboard.title}
          </h1>
          {config.description && (
            <p className="text-[var(--color-gray-600)] mt-1">{config.description}</p>
          )}
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
                  <ChartRenderer key={chart.id} config={chart} data={dashboardData} />
                ))}
              </div>
            )}

            {/* Other Charts Grid */}
            {otherCharts.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {otherCharts.map((chart: ChartConfig) => (
                  <ChartRenderer key={chart.id} config={chart} data={dashboardData} />
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
