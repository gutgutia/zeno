'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NavItem = 'my-dashboards' | 'shared' | 'deleted';

interface DashboardNavProps {
  active: NavItem;
  /** Whether to show the New Dashboard button */
  showNewButton?: boolean;
}

const NAV_ITEMS: { id: NavItem; label: string; href: string; description: string }[] = [
  { id: 'my-dashboards', label: 'My Dashboards', href: '/dashboards', description: 'Create and manage your data visualizations' },
  { id: 'shared', label: 'Shared', href: '/dashboards/shared', description: 'Dashboards that others have shared with you' },
  { id: 'deleted', label: 'Deleted', href: '/dashboards/trash', description: 'Deleted dashboards are kept for 30 days' },
];

/**
 * DashboardNav - Dropdown navigation for dashboard views
 *
 * Shows the current view as a large heading with a dropdown to switch views.
 */
export function DashboardNav({ active, showNewButton = true }: DashboardNavProps) {
  const activeItem = NAV_ITEMS.find(item => item.id === active) || NAV_ITEMS[0];

  return (
    <div className="flex items-center justify-between">
      {/* Dropdown heading */}
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 text-2xl font-bold text-[var(--color-gray-900)] hover:text-[var(--color-gray-700)] transition-colors focus:outline-none">
              {activeItem.label}
              <svg className="w-5 h-5 text-[var(--color-gray-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {NAV_ITEMS.map((item) => (
              <DropdownMenuItem key={item.id} asChild>
                <Link
                  href={item.href}
                  className={item.id === active ? 'font-medium' : ''}
                >
                  {item.label}
                  {item.id === active && (
                    <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <p className="text-[var(--color-gray-600)] mt-1">
          {activeItem.description}
        </p>
      </div>

      {/* New Dashboard button */}
      {showNewButton && (
        <Link href="/dashboards/new">
          <Button>+ New Dashboard</Button>
        </Link>
      )}
    </div>
  );
}
