import type { Metadata } from 'next';
import { AppHeader } from '@/components/layout';
import Link from 'next/link';

// Prevent search engines from indexing settings pages
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-gray-50)]">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-48 flex-shrink-0">
            <div className="sticky top-24">
              <h2 className="text-sm font-semibold text-[var(--color-gray-900)] mb-4">
                Settings
              </h2>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/settings/profile"
                    className="block px-3 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
                  >
                    Profile
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/workspace"
                    className="block px-3 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
                  >
                    Organization
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/team"
                    className="block px-3 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
                  >
                    Team
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/branding"
                    className="block px-3 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
                  >
                    Branding
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/domain"
                    className="block px-3 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
                  >
                    Custom Domain
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/connections"
                    className="block px-3 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
                  >
                    Connections
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/billing"
                    className="block px-3 py-2 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
                  >
                    Billing
                  </Link>
                </li>
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
