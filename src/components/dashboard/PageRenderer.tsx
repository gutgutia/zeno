'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { sanitizeHTML } from '@/lib/rendering/sanitize';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import type { ChartConfig } from '@/types/chart';

interface PageRendererProps {
  html: string;
  charts: Record<string, ChartConfig>;
  data: Record<string, unknown>[];
  className?: string;
}

/**
 * PageRenderer - Renders HTML content with hydrated React chart components
 *
 * This component:
 * 1. Sanitizes the HTML for security
 * 2. Injects the HTML into the DOM
 * 3. Finds chart placeholder elements (data-chart="...")
 * 4. Hydrates each placeholder with the appropriate React chart component
 */
export function PageRenderer({ html, charts, data, className = '' }: PageRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRootsRef = useRef<Map<string, Root>>(new Map());

  // Memoize sanitized HTML to avoid re-sanitizing on every render
  const sanitizedHTML = useMemo(() => {
    return sanitizeHTML(html);
  }, [html]);

  // Cleanup function for chart roots
  const cleanupChartRoots = useCallback(() => {
    chartRootsRef.current.forEach((root) => {
      try {
        root.unmount();
      } catch (e) {
        // Ignore unmount errors
        console.debug('Chart root unmount error:', e);
      }
    });
    chartRootsRef.current.clear();
  }, []);

  // Hydrate chart placeholders with React components
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous chart roots
    cleanupChartRoots();

    // Find all chart placeholders
    const placeholders = containerRef.current.querySelectorAll('[data-chart]');

    placeholders.forEach((placeholder) => {
      const chartId = placeholder.getAttribute('data-chart');
      if (!chartId) return;

      const chartConfig = charts[chartId];
      if (!chartConfig) {
        console.warn(`No chart config found for placeholder: ${chartId}`);
        return;
      }

      // Ensure the chart config has the ID
      const configWithId: ChartConfig = {
        ...chartConfig,
        id: chartConfig.id || chartId,
      };

      try {
        // Create a React root for this placeholder
        const root = createRoot(placeholder as Element);
        chartRootsRef.current.set(chartId, root);

        // Render the chart component
        root.render(
          <ChartRenderer config={configWithId} data={data} />
        );
      } catch (e) {
        console.error(`Failed to render chart ${chartId}:`, e);
      }
    });

    // Cleanup on unmount
    return () => {
      cleanupChartRoots();
    };
  }, [sanitizedHTML, charts, data, cleanupChartRoots]);

  return (
    <div
      ref={containerRef}
      className={`page-renderer ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
}

/**
 * Wrapper component that handles loading states
 */
interface PageRendererWithLoadingProps extends PageRendererProps {
  isLoading?: boolean;
  loadingMessage?: string;
}

export function PageRendererWithLoading({
  isLoading = false,
  loadingMessage = 'Loading...',
  ...props
}: PageRendererWithLoadingProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-gray-600)]">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return <PageRenderer {...props} />;
}

/**
 * Error boundary wrapper for PageRenderer
 */
interface PageRendererSafeProps extends PageRendererProps {
  fallback?: React.ReactNode;
}

export function PageRendererSafe({ fallback, ...props }: PageRendererSafeProps) {
  try {
    return <PageRenderer {...props} />;
  } catch (error) {
    console.error('PageRenderer error:', error);
    return (
      fallback || (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-medium">Failed to render page</h3>
          <p className="text-red-600 text-sm mt-1">
            There was an error rendering this content. Please try refreshing the page.
          </p>
        </div>
      )
    );
  }
}
