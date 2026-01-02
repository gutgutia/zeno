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
 * PublicPageRenderer - Client component wrapper for rendering public dashboards
 *
 * This component handles:
 * 1. Applying branding CSS variables
 * 2. Setting up the page container with proper styling
 * 3. Rendering the HTML content with hydrated charts
 */
export function PublicPageRenderer({
  html,
  charts,
  data,
  branding,
  title
}: PublicPageRendererProps) {
  // Build CSS custom properties from branding
  const brandingStyles: React.CSSProperties = {
    '--branding-primary': branding.colors?.primary || '#2563eb',
    '--branding-secondary': branding.colors?.secondary || '#64748b',
    '--branding-accent': branding.colors?.accent || '#f59e0b',
    '--branding-background': branding.colors?.background || '#ffffff',
  } as React.CSSProperties;

  return (
    <div style={brandingStyles}>
      {/* Header with title and optional logo */}
      <header className="bg-white border-b border-[var(--color-gray-200)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {branding.logoUrl && (
                <img
                  src={branding.logoUrl}
                  alt={branding.companyName || 'Logo'}
                  className="h-8 w-auto"
                />
              )}
              <h1 className="text-xl font-semibold text-[var(--color-gray-900)]">
                {title}
              </h1>
            </div>
            {branding.companyName && !branding.logoUrl && (
              <span className="text-sm text-[var(--color-gray-500)]">
                {branding.companyName}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageRenderer
          html={html}
          charts={charts}
          data={data}
          className="public-page-content"
        />
      </main>

      {/* Inject branding styles for content */}
      <style jsx global>{`
        .public-page-content {
          color: #1e293b;
        }
        .public-page-content h1,
        .public-page-content h2,
        .public-page-content h3 {
          color: #1e293b;
        }
        .public-page-content a {
          color: var(--branding-primary);
        }
        .public-page-content a:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
