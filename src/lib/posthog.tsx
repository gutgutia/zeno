'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * PostHog Analytics Integration
 *
 * Features enabled:
 * - Automatic page view tracking
 * - Error tracking (autocapture exceptions)
 * - Session replay (sampled)
 * - User identification
 */

// Initialize PostHog only on client side
if (typeof window !== 'undefined') {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      // Capture page views manually for better control with Next.js App Router
      capture_pageview: false,
      // Capture page leaves for session duration
      capture_pageleave: true,
      // Enable autocapture for clicks, form submissions, etc.
      autocapture: true,
      // Capture performance metrics
      capture_performance: true,
      // Don't track localhost by default
      disable_session_recording: process.env.NODE_ENV === 'development',
      // Respect Do Not Track
      respect_dnt: true,
    });
  }
}

/**
 * Track page views with Next.js App Router
 */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthogClient = usePostHog();

  useEffect(() => {
    if (pathname && posthogClient) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + '?' + searchParams.toString();
      }
      posthogClient.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthogClient]);

  return null;
}

/**
 * PostHog Provider wrapper
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  // Don't render provider if no key configured
  if (!posthogKey) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}

/**
 * Identify user after authentication
 * Call this after successful login/signup
 */
export function identifyUser(
  userId: string,
  properties?: {
    email?: string;
    name?: string;
    plan?: string;
    organizationId?: string;
    organizationName?: string;
  }
) {
  if (typeof window === 'undefined') return;

  posthog.identify(userId, {
    email: properties?.email,
    name: properties?.name,
    plan: properties?.plan,
    organization_id: properties?.organizationId,
    organization_name: properties?.organizationName,
  });
}

/**
 * Reset user identity on logout
 */
export function resetUser() {
  if (typeof window === 'undefined') return;
  posthog.reset();
}

/**
 * Track custom events
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
) {
  if (typeof window === 'undefined') return;
  posthog.capture(eventName, properties);
}

// Re-export posthog for direct access if needed
export { posthog };
