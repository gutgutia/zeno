import type { Metadata } from 'next';
import { AppHeader } from '@/components/layout';

// Prevent search engines from indexing authenticated dashboard pages
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-gray-50)]">
      <AppHeader />
      <main>{children}</main>
    </div>
  );
}
