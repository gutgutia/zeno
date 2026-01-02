'use client';

import { PageRenderer } from '@/components/dashboard/PageRenderer';
import type { ChartConfig } from '@/types/chart';
import type { BrandingConfig } from '@/types/database';
import Link from 'next/link';

interface WorkspacePageRendererProps {
  html: string;
  charts: Record<string, ChartConfig>;
  data: Record<string, unknown>[];
  branding: BrandingConfig;
  title: string;
  subdomain: string;
}

/**
 * WorkspacePageRenderer - Client component wrapper for rendering workspace dashboards
 *
 * This component handles:
 * 1. Applying branding CSS variables
 * 2. Setting up the page container with workspace branding
 * 3. Rendering the HTML content with hydrated charts
 */
export function WorkspacePageRenderer({
  html,
  charts,
  data,
  branding,
  title,
  subdomain
}: WorkspacePageRendererProps) {
  // Build CSS custom properties from branding
  const brandingStyles: React.CSSProperties = {
    '--branding-primary': branding.colors?.primary || '#2563eb',
    '--branding-secondary': branding.colors?.secondary || '#64748b',
    '--branding-accent': branding.colors?.accent || '#f59e0b',
    '--branding-background': branding.colors?.background || '#ffffff',
  } as React.CSSProperties;

  return (
    <div style={brandingStyles}>
      {/* Header with workspace branding */}
      <header className="bg-white border-b border-[var(--color-gray-200)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {branding.logoUrl ? (
                <Link href="/">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={branding.logoUrl}
                    alt={branding.companyName || 'Logo'}
                    className="h-10 object-contain"
                  />
                </Link>
              ) : (
                <Link href="/" className="text-[var(--color-primary)] font-semibold hover:opacity-80">
                  {branding.companyName || subdomain}
                </Link>
              )}
              <h1 className="text-xl font-semibold text-[var(--color-gray-900)]">
                {title}
              </h1>
            </div>
            <Link
              href="/"
              className="text-sm text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]"
            >
              View all dashboards
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageRenderer
          html={html}
          charts={charts}
          data={data}
          className="workspace-page-content"
        />
      </main>

      {/* Inject branding styles for content */}
      <style jsx global>{`
        .workspace-page-content {
          color: #1e293b;
        }
        .workspace-page-content h1,
        .workspace-page-content h2,
        .workspace-page-content h3 {
          color: #1e293b;
        }
        .workspace-page-content a {
          color: var(--branding-primary);
        }
        .workspace-page-content a:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
