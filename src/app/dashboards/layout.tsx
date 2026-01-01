import { AppHeader } from '@/components/layout';

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
