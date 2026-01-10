'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { PostHogProvider } from '@/lib/posthog';
import { OrganizationProvider } from '@/lib/contexts/organization-context';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <Suspense fallback={null}>
      <PostHogProvider>
        <QueryClientProvider client={queryClient}>
          <OrganizationProvider>
            {children}
          </OrganizationProvider>
          <Toaster position="top-right" />
        </QueryClientProvider>
      </PostHogProvider>
    </Suspense>
  );
}
