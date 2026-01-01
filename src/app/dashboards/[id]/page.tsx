'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChartRenderer } from '@/components/charts';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import type { Dashboard, BrandingConfig } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { ChartConfig } from '@/types/chart';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function DashboardViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);

  // Compute CSS variables for branding
  const brandingStyles = useMemo(() => {
    if (!branding?.colors) return {};
    return {
      '--brand-primary': branding.colors.primary,
      '--brand-secondary': branding.colors.secondary,
      '--brand-accent': branding.colors.accent,
      '--brand-background': branding.colors.background,
    } as React.CSSProperties;
  }, [branding]);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch(`/api/dashboards/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/dashboards');
            return;
          }
          throw new Error('Failed to fetch dashboard');
        }
        const data = await response.json();
        setDashboard(data.dashboard);
        setBranding(data.branding || null);
        setEditedTitle(data.dashboard.title);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboard();
  }, [id, router]);

  const handleTitleSave = async () => {
    if (!dashboard || !editedTitle.trim()) return;

    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editedTitle.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update title');
      }

      const data = await response.json();
      setDashboard(data.dashboard);
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Failed to save title:', err);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading || !dashboard) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await fetch(`/api/dashboards/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          config: dashboard.config,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
      };

      setChatMessages((prev) => [...prev, assistantMessage]);

      // If the config was updated, refresh the dashboard
      if (data.config) {
        setDashboard((prev) => prev ? { ...prev, config: data.config } : null);
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setChatMessages((prev) => [...prev, errorMessage]);
      console.error('Chat error:', err);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!dashboard) return;

    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !dashboard.is_published }),
      });

      if (!response.ok) {
        throw new Error('Failed to update publish status');
      }

      const data = await response.json();
      setDashboard(data.dashboard);
    } catch (err) {
      console.error('Failed to update publish status:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--color-error)] mb-4">{error || 'Dashboard not found'}</p>
          <Link href="/dashboards">
            <Button>Back to Dashboards</Button>
          </Link>
        </div>
      </div>
    );
  }

  const config = dashboard.config as DashboardConfig;
  const data = (dashboard.data as Record<string, unknown>[]) || [];
  const charts = config.charts || [];

  // Separate number cards from other charts for layout
  const numberCards = charts.filter((c: ChartConfig) => c.type === 'number_card');
  const otherCharts = charts.filter((c: ChartConfig) => c.type !== 'number_card');

  return (
    <div className="min-h-screen flex" style={brandingStyles}>
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${isChatOpen ? 'mr-80' : ''}`}>
        {/* Header */}
        <div className="bg-white border-b border-[var(--color-gray-200)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboards"
                className="text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>

              {/* Company Logo */}
              {branding?.logoUrl && (
                <div className="flex items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={branding.logoUrl}
                    alt={branding.companyName || 'Company logo'}
                    className="h-8 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTitleSave();
                      if (e.key === 'Escape') {
                        setIsEditingTitle(false);
                        setEditedTitle(dashboard.title);
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleTitleSave}>Save</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditingTitle(false);
                      setEditedTitle(dashboard.title);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <h1
                  className="text-lg font-semibold text-[var(--color-gray-900)] cursor-pointer hover:text-[var(--color-primary)]"
                  onClick={() => setIsEditingTitle(true)}
                  title="Click to edit"
                >
                  {dashboard.title}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-3">
              {dashboard.is_published && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--color-success)] flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                    Published
                  </span>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/d/${dashboard.slug}`;
                      navigator.clipboard.writeText(url);
                    }}
                    className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1"
                    title="Click to copy public link"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Link
                  </button>
                </div>
              )}
              <ShareDialog
                dashboardId={id}
                isPublished={dashboard.is_published}
              />
              <Button
                variant={dashboard.is_published ? 'outline' : 'default'}
                onClick={handlePublish}
              >
                {dashboard.is_published ? 'Unpublish' : 'Publish'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsChatOpen(!isChatOpen)}
              >
                {isChatOpen ? 'Hide Chat' : 'Show Chat'}
              </Button>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-6">
          {charts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[var(--color-gray-500)] mb-4">
                No charts yet. Use the chat to describe the visualizations you want.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Number Cards Row */}
              {numberCards.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {numberCards.map((chart: ChartConfig) => (
                    <ChartRenderer key={chart.id} config={chart} data={data} />
                  ))}
                </div>
              )}

              {/* Other Charts Grid */}
              {otherCharts.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {otherCharts.map((chart: ChartConfig) => (
                    <ChartRenderer key={chart.id} config={chart} data={data} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-[var(--color-gray-200)] flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-[var(--color-gray-200)]">
            <h2 className="font-semibold text-[var(--color-gray-900)]">Chat</h2>
            <p className="text-sm text-[var(--color-gray-500)]">
              Describe changes to your dashboard
            </p>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-8 text-[var(--color-gray-500)] text-sm">
                <p className="mb-2">Ask me to modify your dashboard</p>
                <p className="text-xs">Examples:</p>
                <ul className="text-xs mt-2 space-y-1">
                  <li>&quot;Add a line chart showing revenue over time&quot;</li>
                  <li>&quot;Change the bar chart to horizontal&quot;</li>
                  <li>&quot;Remove the pie chart&quot;</li>
                </ul>
              </div>
            )}

            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-gray-100)] text-[var(--color-gray-900)]'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-[var(--color-gray-100)] rounded-lg px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-[var(--color-gray-400)] rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-[var(--color-gray-400)] rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-[var(--color-gray-400)] rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChatSubmit} className="p-4 border-t border-[var(--color-gray-200)]">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Describe a change..."
                disabled={isChatLoading}
              />
              <Button type="submit" disabled={isChatLoading || !chatInput.trim()}>
                Send
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
