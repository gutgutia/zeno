'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface User {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  plan_type: string | null;
  credit_balance: number;
  lifetime_credits: number;
  lifetime_used: number;
  dashboard_count: number;
  has_override: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (planFilter) params.set('plan_type', planFilter);
      params.set('page', page.toString());
      params.set('limit', '25');

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchUsers]);

  const getPlanBadgeColor = (plan: string | null, hasOverride: boolean) => {
    if (hasOverride) return 'bg-[var(--color-warning-light)] text-[var(--color-warning)]';
    switch (plan) {
      case 'enterprise': return 'bg-[var(--color-warning-light)] text-[var(--color-warning)]';
      case 'pro': return 'bg-[var(--color-secondary-light)] text-[var(--color-secondary)]';
      case 'starter': return 'bg-[var(--color-primary-light)] text-[var(--color-primary)]';
      default: return 'bg-[var(--color-gray-100)] text-[var(--color-gray-700)]';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Users</h1>
        <span className="text-sm text-[var(--color-gray-500)]">
          {total.toLocaleString()} total users
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {planFilter ? `Plan: ${planFilter}` : 'All Plans'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => { setPlanFilter(''); setPage(1); }}>
              All Plans
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setPlanFilter('free'); setPage(1); }}>
              Free
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setPlanFilter('starter'); setPage(1); }}>
              Starter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setPlanFilter('pro'); setPage(1); }}>
              Pro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setPlanFilter('enterprise'); setPage(1); }}>
              Enterprise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--color-gray-50)] border-b border-[var(--color-gray-200)]">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                User
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Plan
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Credits
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Dashboards
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Created
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-gray-200)]">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[var(--color-gray-200)] rounded-full"></div>
                      <div className="space-y-1">
                        <div className="h-4 bg-[var(--color-gray-200)] rounded w-32"></div>
                        <div className="h-3 bg-[var(--color-gray-200)] rounded w-48"></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><div className="h-5 bg-[var(--color-gray-200)] rounded w-16"></div></td>
                  <td className="px-4 py-3"><div className="h-4 bg-[var(--color-gray-200)] rounded w-12"></div></td>
                  <td className="px-4 py-3"><div className="h-4 bg-[var(--color-gray-200)] rounded w-8"></div></td>
                  <td className="px-4 py-3"><div className="h-4 bg-[var(--color-gray-200)] rounded w-24"></div></td>
                  <td className="px-4 py-3"><div className="h-8 bg-[var(--color-gray-200)] rounded w-16 ml-auto"></div></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-gray-500)]">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-[var(--color-gray-50)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-[var(--color-primary-light)] text-[var(--color-primary)] text-sm">
                          {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-[var(--color-gray-900)]">
                          {user.name || 'No name'}
                        </p>
                        <p className="text-sm text-[var(--color-gray-500)]">
                          {user.email || user.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPlanBadgeColor(user.plan_type, user.has_override)}`}>
                      {user.plan_type || 'free'}
                      {user.has_override && ' *'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-[var(--color-gray-900)]">
                      {user.credit_balance.toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-gray-500)]">
                      used {user.lifetime_used.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-gray-900)]">
                    {user.dashboard_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-gray-500)]">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-gray-500)]">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
