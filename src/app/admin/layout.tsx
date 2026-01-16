'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Home, Users, Building2, Settings, ArrowLeft } from 'lucide-react';

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

      console.log('[Admin] Checking admin access for user:', user?.id, user?.email);

      if (!user) {
        console.log('[Admin] No user found, redirecting to login');
        router.push('/auth/login');
        return;
      }

      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .single<{ role: string }>();

      console.log('[Admin] Query result:', { adminUser, error });

      if (error || !adminUser) {
        console.log('[Admin] Not an admin, redirecting to dashboards. Error:', error?.message);
        router.push('/dashboards');
        return;
      }

      console.log('[Admin] Admin verified with role:', adminUser.role);
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
    { href: '/admin', label: 'Overview', icon: Home },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
    { href: '/admin/settings', label: 'Global Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-gray-50)]">
      {/* Admin Header - Light style matching main app */}
      <header className="sticky top-0 z-50 bg-white border-b border-[var(--color-gray-200)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="flex items-center gap-2">
                <Image
                  src="/brand/logo-primary.svg"
                  alt="Zeno"
                  width={100}
                  height={44}
                  className="h-6 w-auto"
                  priority
                />
              </Link>
              <span className="text-xs font-semibold bg-[var(--color-gray-900)] text-white px-2 py-0.5 rounded">
                ADMIN
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-[var(--color-gray-500)] capitalize">
                {adminRole?.replace('_', ' ')}
              </span>
              <Link
                href="/dashboards"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-gray-600)] hover:text-[var(--color-gray-900)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Exit Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Matching settings layout pattern */}
          <nav className="w-48 flex-shrink-0">
            <div className="sticky top-24">
              <h2 className="text-sm font-semibold text-[var(--color-gray-900)] mb-4">
                Admin Panel
              </h2>
              <ul className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/admin' && pathname.startsWith(item.href));
                  const Icon = item.icon;
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
                        <Icon className="w-4 h-4" />
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
