'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { DashboardShare } from '@/types/database';

interface ShareDialogProps {
  dashboardId: string;
  isPublished: boolean;
  trigger?: React.ReactNode;
}

export function ShareDialog({ dashboardId, isPublished, trigger }: ShareDialogProps) {
  const [shares, setShares] = useState<DashboardShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newShareValue, setNewShareValue] = useState('');
  const [shareType, setShareType] = useState<'email' | 'domain'>('email');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch shares on mount
  useEffect(() => {
    async function fetchShares() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/dashboards/${dashboardId}/shares`);
        if (response.ok) {
          const data = await response.json();
          setShares(data.shares);
        }
      } catch (err) {
        console.error('Failed to fetch shares:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchShares();
  }, [dashboardId]);

  const handleAddShare = async () => {
    if (!newShareValue.trim()) return;

    setIsAdding(true);
    setError(null);

    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          share_type: shareType,
          share_value: newShareValue.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to add share');
        return;
      }

      setShares((prev) => [data.share, ...prev]);
      setNewShareValue('');
    } catch (err) {
      setError('Failed to add share');
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const response = await fetch(`/api/dashboards/${dashboardId}/shares/${shareId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      }
    } catch (err) {
      console.error('Failed to remove share:', err);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Dashboard</DialogTitle>
          <DialogDescription>
            Control who can view this dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Public status */}
          <div className="flex items-center justify-between p-3 bg-[var(--color-gray-50)] rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--color-gray-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">Public access</span>
            </div>
            <span className={`text-sm ${isPublished ? 'text-[var(--color-success)]' : 'text-[var(--color-gray-500)]'}`}>
              {isPublished ? 'Anyone with link' : 'Off'}
            </span>
          </div>

          {/* Add share form */}
          <div className="space-y-3">
            <Label>Share with specific people</Label>
            <div className="flex gap-2">
              <select
                value={shareType}
                onChange={(e) => setShareType(e.target.value as 'email' | 'domain')}
                className="px-3 py-2 border border-[var(--color-gray-200)] rounded-lg text-sm bg-white"
              >
                <option value="email">Email</option>
                <option value="domain">Domain</option>
              </select>
              <Input
                value={newShareValue}
                onChange={(e) => setNewShareValue(e.target.value)}
                placeholder={shareType === 'email' ? 'user@example.com' : 'company.com'}
                className="flex-1"
              />
              <Button onClick={handleAddShare} disabled={isAdding || !newShareValue.trim()}>
                {isAdding ? '...' : 'Add'}
              </Button>
            </div>
            {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
            <p className="text-xs text-[var(--color-gray-500)]">
              {shareType === 'email'
                ? 'Share with a specific email address'
                : 'Share with everyone from a domain (e.g., company.com)'}
            </p>
          </div>

          {/* Current shares */}
          {isLoading ? (
            <div className="text-center py-4 text-[var(--color-gray-500)]">Loading...</div>
          ) : shares.length > 0 ? (
            <div className="space-y-2">
              <Label>People with access</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-2 border border-[var(--color-gray-200)] rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
                        share.share_type === 'domain' ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-secondary)]'
                      }`}>
                        {share.share_type === 'domain' ? '@' : share.share_value.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {share.share_type === 'domain' ? `@${share.share_value}` : share.share_value}
                        </p>
                        <p className="text-xs text-[var(--color-gray-500)]">
                          {share.share_type === 'domain' ? 'Domain' : 'Email'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveShare(share.id)}
                      className="text-[var(--color-gray-400)] hover:text-[var(--color-error)] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-gray-500)] text-center py-4">
              No shares yet. Add emails or domains above.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
