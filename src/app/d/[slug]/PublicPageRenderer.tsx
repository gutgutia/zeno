'use client';

import { PageRenderer } from '@/components/dashboard/PageRenderer';
import type { ChartConfig } from '@/types/chart';
import type { BrandingConfig } from '@/types/database';

interface PublicPageRendererProps {
  html: string;
  charts: Record<string, ChartConfig>;
  data: Record<string, unknown>[];
  branding: BrandingConfig;
  title: string;
}

/**
 * PublicPageRenderer - Client component wrapper for rendering public/shared dashboards
 *
 * This component handles:
 * 1. Applying branding CSS variables
 * 2. Setting up the page container with proper styling (matching owner view)
 * 3. Rendering the HTML content with hydrated charts
 *
 * Note: The header is now handled by SharedDashboardHeader in the parent page
 */
export function PublicPageRenderer({
  html,
  charts,
  data,
  branding,
}: PublicPageRendererProps) {
  // Build CSS custom properties from branding
  const brandingStyles: React.CSSProperties = {
    '--branding-primary': branding.colors?.primary || '#2563eb',
    '--branding-secondary': branding.colors?.secondary || '#64748b',
    '--branding-accent': branding.colors?.accent || '#f59e0b',
    '--branding-background': branding.colors?.background || '#ffffff',
    '--brand-primary': branding.colors?.primary || '#2563eb',
    '--brand-secondary': branding.colors?.secondary || '#64748b',
    '--brand-accent': branding.colors?.accent || '#f59e0b',
    '--brand-background': branding.colors?.background || '#ffffff',
  } as React.CSSProperties;

  return (
    <div style={brandingStyles}>
      {/* Main content - matching owner view styling */}
      <main className="transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Dashboard content with same wrapper as owner view */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <PageRenderer
              html={html}
              charts={charts}
              data={data}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
