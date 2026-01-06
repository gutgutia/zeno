'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Dashboard } from '@/types/database';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

export default function TrashPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionDashboard, setActionDashboard] = useState<Dashboard | null>(null);
  const [actionType, setActionType] = useState<'restore' | 'delete' | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    fetchDeletedDashboards();
  }, []);

  const fetchDeletedDashboards = async () => {
    try {
      const response = await fetch('/api/dashboards/trash');
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth');
          return;
        }
        throw new Error('Failed to fetch deleted dashboards');
      }
      const data = await response.json();
      setDashboards(data.dashboards);
    } catch (error) {
      console.error('Error fetching deleted dashboards:', error);
      toast.error('Failed to load trash');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!actionDashboard) return;

    setIsActionLoading(true);
    try {
      const response = await fetch(`/api/dashboards/${actionDashboard.id}/restore`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to restore dashboard');
      }

      toast.success('Dashboard restored');
      setDashboards((prev) => prev.filter((d) => d.id !== actionDashboard.id));
    } catch (error) {
      console.error('Restore error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to restore dashboard');
    } finally {
      setIsActionLoading(false);
      setActionDashboard(null);
      setActionType(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!actionDashboard) return;

    setIsActionLoading(true);
    try {
      const response = await fetch(`/api/dashboards/${actionDashboard.id}/permanent`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to permanently delete dashboard');
      }

      toast.success('Dashboard permanently deleted');
      setDashboards((prev) => prev.filter((d) => d.id !== actionDashboard.id));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete dashboard');
    } finally {
      setIsActionLoading(false);
      setActionDashboard(null);
      setActionType(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <DashboardNav active="deleted" showNewButton={false} />
      </div>

      {/* Trash List or Empty State */}
      {dashboards.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-[var(--color-gray-100)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-[var(--color-gray-400)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
            Trash is empty
          </h2>
          <p className="text-[var(--color-gray-600)] mb-6 max-w-sm mx-auto">
            Deleted dashboards will appear here. You can restore them or permanently delete them.
          </p>
          <Link href="/dashboards">
            <Button variant="outline">Back to Dashboards</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {dashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              className="flex items-center justify-between p-4 bg-white rounded-xl border border-[var(--color-gray-200)]"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[var(--color-gray-900)] truncate">
                  {dashboard.title}
                </h3>
                <p className="text-sm text-[var(--color-gray-500)]">
                  Deleted {dashboard.deleted_at ? formatTimeAgo(dashboard.deleted_at) : 'recently'}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActionDashboard(dashboard);
                    setActionType('restore');
                  }}
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActionDashboard(dashboard);
                    setActionType('delete');
                  }}
                  className="text-[var(--color-error)] hover:text-[var(--color-error)] hover:bg-red-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={actionType === 'restore'}
        onOpenChange={() => {
          setActionDashboard(null);
          setActionType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Dashboard</DialogTitle>
            <DialogDescription>
              Restore &quot;{actionDashboard?.title}&quot; to your dashboards?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDashboard(null);
                setActionType(null);
              }}
              disabled={isActionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={isActionLoading}>
              {isActionLoading ? 'Restoring...' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog
        open={actionType === 'delete'}
        onOpenChange={() => {
          setActionDashboard(null);
          setActionType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete &quot;{actionDashboard?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionDashboard(null);
                setActionType(null);
              }}
              disabled={isActionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
              disabled={isActionLoading}
            >
              {isActionLoading ? 'Deleting...' : 'Delete Forever'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
