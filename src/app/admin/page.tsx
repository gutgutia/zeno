'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalDashboards: number;
  totalCreditsUsed: number;
  planDistribution: {
    free: number;
    starter: number;
    pro: number;
    enterprise: number;
  };
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();

      // Get total users count
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get users active in last 30 days (approximated by updated_at)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: activeUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', thirtyDaysAgo.toISOString());

      // Get total dashboards
      const { count: totalDashboards } = await supabase
        .from('dashboards')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      // Get total credits used from transactions
      const { data: creditData } = await supabase
        .from('credit_transactions')
        .select('amount')
        .lt('amount', 0);

      const totalCreditsUsed = creditData?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

      // Get plan distribution
      const { data: planData } = await supabase
        .from('profiles')
        .select('plan_type');

      const planDistribution = {
        free: 0,
        starter: 0,
        pro: 0,
        enterprise: 0,
      };

      planData?.forEach((p) => {
        const plan = p.plan_type as keyof typeof planDistribution;
        if (plan in planDistribution) {
          planDistribution[plan]++;
        } else {
          planDistribution.free++;
        }
      });

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalDashboards: totalDashboards || 0,
        totalCreditsUsed,
        planDistribution,
      });
      setLoading(false);
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Admin Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          href="/admin/users"
        />
        <StatCard
          title="Active Users (30d)"
          value={stats?.activeUsers || 0}
          subtitle={`${((stats?.activeUsers || 0) / (stats?.totalUsers || 1) * 100).toFixed(0)}% of total`}
        />
        <StatCard
          title="Total Dashboards"
          value={stats?.totalDashboards || 0}
        />
        <StatCard
          title="Credits Used"
          value={stats?.totalCreditsUsed || 0}
        />
      </div>

      {/* Plan Distribution */}
      <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Plan Distribution</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PlanCard label="Free" count={stats?.planDistribution.free || 0} color="gray" />
          <PlanCard label="Starter" count={stats?.planDistribution.starter || 0} color="blue" />
          <PlanCard label="Pro" count={stats?.planDistribution.pro || 0} color="purple" />
          <PlanCard label="Enterprise" count={stats?.planDistribution.enterprise || 0} color="orange" />
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/users"
            className="inline-flex items-center px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Manage Users
          </Link>
          <Link
            href="/admin/settings"
            className="inline-flex items-center px-4 py-2 bg-[var(--color-gray-100)] text-[var(--color-gray-700)] rounded-lg hover:bg-[var(--color-gray-200)] transition-colors"
          >
            Global Settings
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  href,
}: {
  title: string;
  value: number;
  subtitle?: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-sm text-[var(--color-gray-500)]">{title}</p>
      <p className="text-2xl font-bold text-[var(--color-gray-900)]">
        {value.toLocaleString()}
      </p>
      {subtitle && (
        <p className="text-xs text-[var(--color-gray-400)] mt-1">{subtitle}</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6 hover:border-[var(--color-primary)] transition-colors"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[var(--color-gray-200)] p-6">
      {content}
    </div>
  );
}

function PlanCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: 'gray' | 'blue' | 'purple' | 'orange';
}) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="text-center p-4 rounded-lg bg-[var(--color-gray-50)]">
      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${colorClasses[color]}`}>
        {label}
      </span>
      <p className="text-xl font-bold text-[var(--color-gray-900)] mt-2">
        {count.toLocaleString()}
      </p>
      <p className="text-xs text-[var(--color-gray-500)]">users</p>
    </div>
  );
}
