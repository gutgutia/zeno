'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { usePlan } from '@/lib/hooks';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';

interface GoogleConnection {
  id: string;
  google_email: string;
  created_at: string;
}

function ConnectionsContent() {
  const { features, isLoading: isPlanLoading } = usePlan();
  const canUseGoogleSheets = features.google_sheets;

  const [connection, setConnection] = useState<GoogleConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const searchParams = useSearchParams();

  // Handle OAuth callback results
  useEffect(() => {
    const googleConnected = searchParams.get('google_connected');
    const googleError = searchParams.get('google_error');
    const googleEmail = searchParams.get('google_email');

    if (googleConnected === 'true' && googleEmail) {
      toast.success(`Connected to Google as ${googleEmail}`);
      // Clean up URL
      window.history.replaceState({}, '', '/settings/connections');
    } else if (googleError) {
      toast.error(googleError);
      // Clean up URL
      window.history.replaceState({}, '', '/settings/connections');
    }
  }, [searchParams]);

  useEffect(() => {
    fetchConnection();
  }, []);

  async function fetchConnection() {
    try {
      const supabase = createClient();
      
      // Get user's workspace
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .eq('type', 'personal')
        .single();

      if (!workspace) return;

      // Get Google connection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: connectionData } = await (supabase as any)
        .from('google_connections')
        .select('id, google_email, created_at')
        .eq('workspace_id', (workspace as any).id)
        .single();

      setConnection(connectionData);
    } catch (error) {
      console.error('Error fetching connection:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect your Google account? Your dashboards will keep their current data, but will no longer sync.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const response = await fetch('/api/google/disconnect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnection(null);
      toast.success('Google account disconnected');
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect Google account');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleConnect() {
    try {
      const supabase = createClient();
      
      // Get user's workspace
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in first');
        return;
      }

      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .eq('type', 'personal')
        .single();

      if (!workspace) {
        toast.error('Workspace not found');
        return;
      }

      // Get the Google OAuth URL
      const response = await fetch(`/api/auth/google?workspace_id=${(workspace as any).id}&return_url=/settings/connections`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start Google authentication');
      }

      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error connecting Google:', error);
      toast.error('Failed to connect Google account');
    }
  }

  if (loading || isPlanLoading) {
    return (
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--color-gray-100)] rounded w-48 mb-4"></div>
          <div className="h-4 bg-[var(--color-gray-100)] rounded w-full mb-2"></div>
          <div className="h-4 bg-[var(--color-gray-100)] rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
          Connected Accounts
        </h1>
        <p className="text-[var(--color-gray-600)] mt-1">
          Manage your connected services and integrations
        </p>
      </div>

      {/* Google Sheets Connection */}
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Google Icon */}
            <div className="w-12 h-12 bg-[var(--color-gray-100)] rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>

            {/* Connection Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-[var(--color-gray-900)]">
                Google Sheets
              </h3>
              
              {connection ? (
                <div className="mt-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      Connected
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-gray-600)] mt-2">
                    Connected as <span className="font-medium">{connection.google_email}</span>
                  </p>
                  <p className="text-xs text-[var(--color-gray-500)] mt-1">
                    Connected on {new Date(connection.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-gray-600)] mt-1">
                  Connect your Google account to import data from Google Sheets
                </p>
              )}
            </div>

            {/* Action Button */}
            <div className="flex-shrink-0">
              {connection ? (
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                >
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              ) : canUseGoogleSheets ? (
                <Button onClick={handleConnect}>
                  Connect
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 py-1 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Pro
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info Footer */}
        {connection && (
          <div className="bg-[var(--color-gray-50)] border-t border-[var(--color-gray-200)] px-6 py-4">
            <h4 className="text-sm font-medium text-[var(--color-gray-900)] mb-2">
              What happens when you disconnect:
            </h4>
            <ul className="text-sm text-[var(--color-gray-600)] space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-gray-400)]">•</span>
                Your Google Sheets will no longer sync automatically
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-gray-400)]">•</span>
                Existing dashboards will keep their current data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--color-gray-400)]">•</span>
                You can reconnect your account anytime
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Upgrade prompt for Google Sheets */}
      {!canUseGoogleSheets && !connection && (
        <UpgradePrompt
          title="Google Sheets Integration"
          description="Connect your Google account to import data directly from Google Sheets. Changes in your spreadsheets automatically sync to your dashboards."
          requiredPlan="pro"
        />
      )}

      {/* Future integrations placeholder */}
      <div className="bg-white rounded-xl border border-dashed border-[var(--color-gray-300)] p-6">
        <div className="text-center">
          <p className="text-sm text-[var(--color-gray-500)]">
            More integrations coming soon: Airtable, Notion, and more
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectionsLoadingFallback() {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-gray-200)] p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-[var(--color-gray-100)] rounded w-48 mb-4"></div>
        <div className="h-4 bg-[var(--color-gray-100)] rounded w-full mb-2"></div>
        <div className="h-4 bg-[var(--color-gray-100)] rounded w-3/4"></div>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<ConnectionsLoadingFallback />}>
      <ConnectionsContent />
    </Suspense>
  );
}

