'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  billing_cycle: string;
  seats_purchased: number;
  subdomain: string | null;
  custom_domain: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  member_count: number;
  credit_balance: number;
  lifetime_credits: number;
  lifetime_used: number;
  dashboard_count: number;
  has_override: boolean;
  created_at: string;
}

interface OrgsResponse {
  organizations: Organization[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (planFilter) params.set('plan_type', planFilter);
      params.set('page', page.toString());
      params.set('limit', '25');

      const response = await fetch(`/api/admin/organizations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch organizations');

      const data: OrgsResponse = await response.json();
      setOrgs(data.organizations);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, page]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchOrgs();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchOrgs]);

  const getPlanBadgeColor = (plan: string, hasOverride: boolean) => {
    if (hasOverride) return 'bg-yellow-100 text-yellow-800';
    switch (plan) {
      case 'enterprise': return 'bg-orange-100 text-orange-800';
      case 'pro': return 'bg-purple-100 text-purple-800';
      case 'team': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Organizations</h1>
        <span className="text-sm text-[var(--color-gray-500)]">
          {total.toLocaleString()} total organizations
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search by name or slug..."
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
            <DropdownMenuItem onClick={() => { setPlanFilter('team'); setPage(1); }}>
              Team
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setPlanFilter('enterprise'); setPage(1); }}>
              Enterprise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Organization Table */}
      <div className="bg-white rounded-lg border border-[var(--color-gray-200)] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--color-gray-50)] border-b border-[var(--color-gray-200)]">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Organization
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Plan
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Members
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Credits
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Dashboards
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-gray-500)] uppercase">
                Billing
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
                    <div className="space-y-1">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-3 bg-gray-200 rounded w-24"></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><div className="h-5 bg-gray-200 rounded w-16"></div></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                  <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                  <td className="px-4 py-3"><div className="h-8 bg-gray-200 rounded w-16 ml-auto"></div></td>
                </tr>
              ))
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-gray-500)]">
                  No organizations found
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} className="hover:bg-[var(--color-gray-50)]">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-[var(--color-gray-900)]">{org.name}</p>
                      <p className="text-sm text-[var(--color-gray-500)]">{org.slug}</p>
                      {(org.subdomain || org.custom_domain) && (
                        <p className="text-xs text-[var(--color-primary)]">
                          {org.custom_domain || `${org.subdomain}.zeno.app`}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPlanBadgeColor(org.plan_type, org.has_override)}`}>
                      {org.plan_type}
                      {org.has_override && ' *'}
                    </span>
                    <p className="text-xs text-[var(--color-gray-500)] mt-0.5">
                      {org.seats_purchased} seats • {org.billing_cycle}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-gray-900)]">
                    {org.member_count}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-[var(--color-gray-900)]">
                      {org.credit_balance.toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-gray-500)]">
                      used {org.lifetime_used.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-gray-900)]">
                    {org.dashboard_count}
                  </td>
                  <td className="px-4 py-3">
                    {org.stripe_subscription_id ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        No subscription
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/admin/organizations/${org.id}`)}
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
