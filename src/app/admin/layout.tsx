'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminRole, setAdminRole] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error || !adminUser) {
        // Not an admin, redirect to dashboards
        router.push('/dashboards');
        return;
      }

      setIsAdmin(true);
      setAdminRole(adminUser.role);
    }

    checkAdmin();
  }, [router]);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-[var(--color-gray-50)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const navItems = [
    { href: '/admin', label: 'Overview', icon: HomeIcon },
    { href: '/admin/users', label: 'Users', icon: UsersIcon },
    { href: '/admin/organizations', label: 'Organizations', icon: BuildingIcon },
    { href: '/admin/settings', label: 'Global Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-gray-50)]">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 bg-[var(--color-gray-900)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="flex items-center gap-2">
                <Image
                  src="/brand/logo-white.svg"
                  alt="Zeno"
                  width={100}
                  height={44}
                  className="h-6 w-auto"
                  priority
                />
                <span className="text-xs font-medium bg-[var(--color-primary)] px-2 py-0.5 rounded">
                  ADMIN
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300 capitalize">
                {adminRole?.replace('_', ' ')}
              </span>
              <Link
                href="/dashboards"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Exit Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-48 flex-shrink-0">
            <div className="sticky top-24">
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/admin' && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                          isActive
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] hover:bg-[var(--color-gray-100)]'
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
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

// Simple icons
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
