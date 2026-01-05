'use client';

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
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
 * Check if HTML contains JavaScript or Chart.js that needs iframe rendering
 */
function needsIframeRendering(html: string): boolean {
  // Check for script tags or Chart.js references
  return /<script\b/i.test(html) || /chart\.js/i.test(html) || /new Chart\(/i.test(html);
}

/**
 * IframeRenderer - Renders full HTML in a sandboxed iframe
 * Used when the HTML contains JavaScript/Chart.js that needs to execute
 */
function IframeRenderer({ html, className }: { html: string; className: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(800);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Set up resize observer to adjust iframe height
    const resizeObserver = new ResizeObserver(() => {
      if (iframe.contentDocument?.body) {
        const newHeight = iframe.contentDocument.body.scrollHeight;
        if (newHeight > 0 && newHeight !== height) {
          setHeight(Math.max(newHeight + 32, 400)); // Add padding, min 400px
        }
      }
    });

    // Wait for iframe to load then observe
    const handleLoad = () => {
      if (iframe.contentDocument?.body) {
        resizeObserver.observe(iframe.contentDocument.body);
        // Initial height adjustment
        const initialHeight = iframe.contentDocument.body.scrollHeight;
        if (initialHeight > 0) {
          setHeight(Math.max(initialHeight + 32, 400));
        }
      }
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      resizeObserver.disconnect();
    };
  }, [html, height]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      className={className}
      style={{
        width: '100%',
        height: `${height}px`,
        border: 'none',
        overflow: 'hidden',
      }}
      sandbox="allow-scripts allow-same-origin"
      title="Dashboard Content"
    />
  );
}

/**
 * PageRenderer - Renders HTML content with hydrated React chart components
 *
 * This component:
 * 1. Detects if HTML needs iframe rendering (contains JavaScript/Chart.js)
 * 2. For iframe mode: renders full HTML in sandboxed iframe
 * 3. For legacy mode: sanitizes HTML and hydrates chart placeholders
 */
export function PageRenderer({ html, charts, data, className = '' }: PageRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRootsRef = useRef<Map<string, Root>>(new Map());

  // Check if we need iframe rendering
  const useIframe = useMemo(() => needsIframeRendering(html), [html]);

  // Extract body styles and content from the HTML (legacy mode)
  const { bodyStyles, bodyContent } = useMemo(() => {
    if (useIframe) {
      return { bodyStyles: '', bodyContent: '' };
    }

    let sanitized = sanitizeHTML(html);

    // Try to extract body styles
    const bodyMatch = sanitized.match(/<body[^>]*style=["']([^"']*)["'][^>]*>/i);
    const extractedStyles = bodyMatch ? bodyMatch[1] : '';

    // Extract just the body content (remove DOCTYPE, html, head, body tags)
    let content = sanitized;

    // Remove DOCTYPE
    content = content.replace(/<!DOCTYPE[^>]*>/gi, '');
    // Remove html opening/closing
    content = content.replace(/<\/?html[^>]*>/gi, '');
    // Remove head section entirely
    content = content.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    // Remove body tags but keep content
    content = content.replace(/<body[^>]*>/gi, '');
    content = content.replace(/<\/body>/gi, '');

    return {
      bodyStyles: extractedStyles,
      bodyContent: content.trim(),
    };
  }, [html, useIframe]);

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

  // Hydrate chart placeholders with React components (legacy mode)
  useEffect(() => {
    if (useIframe || !containerRef.current) return;

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
  }, [useIframe, bodyContent, charts, data, cleanupChartRoots]);

  // Use iframe for HTML with JavaScript/Chart.js
  if (useIframe) {
    return <IframeRenderer html={html} className={`page-renderer ${className}`} />;
  }

  // Legacy mode: sanitized HTML with React chart hydration
  return (
    <div
      ref={containerRef}
      className={`page-renderer ${className}`}
      style={bodyStyles ? undefined : { padding: '24px' }}
      dangerouslySetInnerHTML={{ __html: bodyStyles ? `<div style="${bodyStyles}">${bodyContent}</div>` : bodyContent }}
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
