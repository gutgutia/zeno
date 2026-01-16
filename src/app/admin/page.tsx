'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Users, LayoutDashboard, Coins, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        .lt('amount', 0) as { data: { amount: number }[] | null };

      const totalCreditsUsed = creditData?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

      // Get plan distribution
      const { data: planData } = await supabase
        .from('profiles')
        .select('plan_type') as { data: { plan_type: string | null }[] | null };

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
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 animate-pulse">
              <div className="h-4 bg-[var(--color-gray-200)] rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-[var(--color-gray-200)] rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">Overview</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          href="/admin/users"
          icon={Users}
          iconColor="text-[var(--color-primary)]"
          iconBg="bg-[var(--color-primary-light)]"
        />
        <StatCard
          title="Active Users (30d)"
          value={stats?.activeUsers || 0}
          subtitle={`${((stats?.activeUsers || 0) / (stats?.totalUsers || 1) * 100).toFixed(0)}% of total`}
          icon={TrendingUp}
          iconColor="text-[var(--color-teal)]"
          iconBg="bg-[var(--color-teal-light)]"
        />
        <StatCard
          title="Total Dashboards"
          value={stats?.totalDashboards || 0}
          icon={LayoutDashboard}
          iconColor="text-[var(--color-secondary)]"
          iconBg="bg-[var(--color-secondary-light)]"
        />
        <StatCard
          title="Credits Used"
          value={stats?.totalCreditsUsed || 0}
          icon={Coins}
          iconColor="text-[var(--color-warning)]"
          iconBg="bg-[var(--color-warning-light)]"
        />
      </div>

      {/* Plan Distribution */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Plan Distribution</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <PlanCard label="Free" count={stats?.planDistribution.free || 0} variant="gray" />
          <PlanCard label="Starter" count={stats?.planDistribution.starter || 0} variant="primary" />
          <PlanCard label="Pro" count={stats?.planDistribution.pro || 0} variant="secondary" />
          <PlanCard label="Enterprise" count={stats?.planDistribution.enterprise || 0} variant="warning" />
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/admin/users">
              <Users className="w-4 h-4 mr-2" />
              Manage Users
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/organizations">
              Manage Organizations
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/settings">
              Global Settings
            </Link>
          </Button>
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
  icon: Icon,
  iconColor,
  iconBg,
}: {
  title: string;
  value: number;
  subtitle?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}) {
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-[var(--color-gray-500)]">{title}</p>
        <p className="text-2xl font-bold text-[var(--color-gray-900)] mt-1">
          {value.toLocaleString()}
        </p>
        {subtitle && (
          <p className="text-xs text-[var(--color-gray-400)] mt-1">{subtitle}</p>
        )}
      </div>
      <div className={`p-2 rounded-lg ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6 hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6">
      {content}
    </div>
  );
}

function PlanCard({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: 'gray' | 'primary' | 'secondary' | 'warning';
}) {
  const variantClasses = {
    gray: 'bg-[var(--color-gray-100)] text-[var(--color-gray-700)]',
    primary: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
    secondary: 'bg-[var(--color-secondary-light)] text-[var(--color-secondary)]',
    warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
  };

  return (
    <div className="text-center p-4 rounded-lg bg-[var(--color-gray-50)]">
      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
        {label}
      </span>
      <p className="text-xl font-bold text-[var(--color-gray-900)] mt-2">
        {count.toLocaleString()}
      </p>
      <p className="text-xs text-[var(--color-gray-500)]">users</p>
    </div>
  );
}
