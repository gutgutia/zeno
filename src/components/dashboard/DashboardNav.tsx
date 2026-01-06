'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

type NavItem = 'my-dashboards' | 'shared' | 'deleted';

interface DashboardNavProps {
  active: NavItem;
  /** Whether to show the New Dashboard button */
  showNewButton?: boolean;
}

const NAV_ITEMS: { id: NavItem; label: string; href: string }[] = [
  { id: 'my-dashboards', label: 'My Dashboards', href: '/dashboards' },
  { id: 'shared', label: 'Shared', href: '/dashboards/shared' },
  { id: 'deleted', label: 'Deleted', href: '/dashboards/trash' },
];

/**
 * DashboardNav - Subtle text navigation for dashboard views
 *
 * Shows "My Dashboards", "Shared", and "Deleted" as text links
 * with the active item emphasized and others subtle.
 */
export function DashboardNav({ active, showNewButton = true }: DashboardNavProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      {/* Navigation links */}
      <nav className="flex items-center gap-6">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`text-lg transition-colors ${
                isActive
                  ? 'font-bold text-[var(--color-gray-900)]'
                  : 'font-medium text-[var(--color-gray-400)] hover:text-[var(--color-gray-600)]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* New Dashboard button */}
      {showNewButton && (
        <Link href="/dashboards/new">
          <Button>+ New Dashboard</Button>
        </Link>
      )}
    </div>
  );
}
