'use client';

import { useState, useEffect, use, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageRenderer } from '@/components/dashboard/PageRenderer';
import { ShareDialog } from '@/components/dashboard/ShareDialog';
import { toast } from 'sonner';
import type { Dashboard, BrandingConfig } from '@/types/database';
import type { DashboardConfig, GenerationStatus } from '@/types/dashboard';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const POLL_INTERVAL = 3000; // 3 seconds

export default function DashboardEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Chat state - closed by default
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

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
  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/dashboards/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/dashboards');
          return null;
        }
        throw new Error('Failed to fetch dashboard');
      }
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  }, [id, router]);

  // Initial fetch
  useEffect(() => {
    async function init() {
      const data = await fetchDashboard();
      if (data) {
        setDashboard(data.dashboard);
        setBranding(data.branding || null);
        setEditedTitle(data.dashboard.title);
      }
      setIsLoading(false);
    }
    init();
  }, [fetchDashboard]);

  // Poll for generation status updates
  useEffect(() => {
    if (!dashboard) return;

    const status = dashboard.generation_status as GenerationStatus;
    const isGenerating = status === 'pending' || status === 'analyzing' || status === 'generating';

    if (!isGenerating) return;

    const interval = setInterval(async () => {
      const data = await fetchDashboard();
      if (data) {
        const newStatus = data.dashboard.generation_status as GenerationStatus;
        setDashboard(data.dashboard);

        if (newStatus === 'completed') {
          toast.success('Your dashboard is ready!');
          clearInterval(interval);
        } else if (newStatus === 'failed') {
          toast.error('Generation failed. Please try again.');
          clearInterval(interval);
        }
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [dashboard?.generation_status, fetchDashboard]);

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
      toast.success('Title updated');
    } catch (err) {
      console.error('Failed to save title:', err);
      toast.error('Failed to update title');
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading || !dashboard?.config) return;

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
        toast.success('Dashboard updated');
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
      toast.success(data.dashboard.is_published ? 'Dashboard published!' : 'Dashboard unpublished');
    } catch (err) {
      console.error('Failed to update publish status:', err);
      toast.error('Failed to update publish status');
    }
  };

  const handleCopyLink = () => {
    if (!dashboard) return;
    const url = `${window.location.origin}/d/${dashboard.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard!');
  };

  const handleRetryGeneration = async () => {
    try {
      const response = await fetch(`/api/dashboards/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to retry generation');
      }

      // Refetch to get updated status
      const data = await fetchDashboard();
      if (data) {
        setDashboard(data.dashboard);
      }
      toast.info('Retrying generation...');
    } catch (err) {
      console.error('Failed to retry generation:', err);
      toast.error('Failed to retry generation');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-gray-50)]">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-gray-50)]">
        <div className="text-center">
          <p className="text-[var(--color-error)] mb-4">{error || 'Dashboard not found'}</p>
          <Link href="/dashboards">
            <Button>Back to Dashboards</Button>
          </Link>
        </div>
      </div>
    );
  }

  const generationStatus = dashboard.generation_status as GenerationStatus;
  const isGenerating = generationStatus === 'pending' || generationStatus === 'analyzing' || generationStatus === 'generating';
  const hasFailed = generationStatus === 'failed';
  const isComplete = generationStatus === 'completed' && dashboard.config;

  const config = dashboard.config as DashboardConfig | null;
  const data = (dashboard.data as Record<string, unknown>[]) || [];

  return (
    <div style={brandingStyles}>
      {/* Dashboard Title Bar - Constrained width */}
      <div className="bg-white border-b border-[var(--color-gray-200)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 gap-4">
            {/* Left side - Back + Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link
                href="/dashboards"
                className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)] hover:bg-[var(--color-gray-100)] transition-colors"
                title="Back to dashboards"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>

              {/* Company Logo (from branding) */}
              {branding?.logoUrl && (
                <div className="flex-shrink-0 hidden sm:block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={branding.logoUrl}
                    alt={branding.companyName || 'Company logo'}
                    className="h-7 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Title */}
              <div className="min-w-0 flex-1">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="text-lg font-semibold max-w-sm"
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
                      variant="ghost"
                      onClick={() => {
                        setIsEditingTitle(false);
                        setEditedTitle(dashboard.title);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="group flex items-center gap-2 text-left"
                    title="Click to edit title"
                  >
                    <h1 className="text-lg font-semibold text-[var(--color-gray-900)] truncate">
                      {dashboard.title}
                    </h1>
                    <svg
                      className="w-4 h-4 text-[var(--color-gray-400)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Generation Status Badge */}
              {isGenerating && (
                <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  {generationStatus === 'analyzing' ? 'Analyzing...' :
                   generationStatus === 'generating' ? 'Generating...' : 'Pending...'}
                </span>
              )}
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Edit with AI Button */}
              {isComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChatOpen(true)}
                  className="hidden sm:flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Edit with AI
                </Button>
              )}

              {/* Share Button */}
              <ShareDialog
                dashboardId={id}
                isPublished={dashboard.is_published}
              />

              {/* Publish/Unpublish Button */}
              <Button
                variant={dashboard.is_published ? 'outline' : 'default'}
                size="sm"
                onClick={handlePublish}
                disabled={!isComplete}
              >
                {dashboard.is_published ? 'Unpublish' : 'Publish'}
              </Button>

              {/* Copy Link Button (only when published) */}
              {dashboard.is_published && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyLink}
                  className="hidden md:flex items-center gap-1.5"
                  title="Copy public link"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Constrained width */}
      <main className={`transition-all duration-300 ${isChatOpen ? 'lg:mr-96' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Generating State */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-white rounded-xl shadow-sm p-8">
              <div className="w-16 h-16 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-6" />
              <h2 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
                {generationStatus === 'analyzing' ? 'Analyzing your content...' :
                 generationStatus === 'generating' ? 'Designing your dashboard...' :
                 'Starting generation...'}
              </h2>
              <p className="text-[var(--color-gray-600)] max-w-md">
                {generationStatus === 'analyzing'
                  ? 'Our AI is analyzing your data to understand its structure and patterns.'
                  : generationStatus === 'generating'
                  ? 'Creating a beautiful, insightful dashboard based on your content.'
                  : 'Your dashboard generation will begin shortly.'}
              </p>
              {dashboard.notify_email && (
                <p className="text-sm text-[var(--color-gray-500)] mt-4">
                  We&apos;ll email you when it&apos;s ready. Feel free to close this page.
                </p>
              )}
            </div>
          )}

          {/* Failed State */}
          {hasFailed && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-white rounded-xl shadow-sm p-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-gray-900)] mb-2">
                Generation Failed
              </h2>
              <p className="text-[var(--color-gray-600)] max-w-md mb-4">
                {dashboard.generation_error || 'Something went wrong while generating your dashboard.'}
              </p>
              <Button onClick={handleRetryGeneration}>
                Try Again
              </Button>
            </div>
          )}

          {/* Completed State - Render the dashboard */}
          {isComplete && config && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <PageRenderer
                html={config.html}
                charts={config.charts}
                data={data}
              />
            </div>
          )}

          {/* No config yet and not generating/failed */}
          {!isComplete && !isGenerating && !hasFailed && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-white rounded-xl shadow-sm p-8">
              <p className="text-[var(--color-gray-500)] mb-4">
                No content generated yet.
              </p>
              <Button onClick={handleRetryGeneration}>
                Generate Dashboard
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Edit with AI FAB */}
      {isComplete && !isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="sm:hidden fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-[var(--color-primary)] text-white rounded-full shadow-lg hover:shadow-xl transition-all"
          title="Edit dashboard with AI"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Chat Panel - Slide in from right */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white border-l border-[var(--color-gray-200)] shadow-xl flex flex-col z-50 transform transition-transform duration-300 ${
          isChatOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-gray-200)] bg-[var(--color-gray-50)]">
          <div>
            <h2 className="font-semibold text-[var(--color-gray-900)]">Edit Dashboard</h2>
            <p className="text-sm text-[var(--color-gray-500)]">
              Describe changes you&apos;d like to make
            </p>
          </div>
          <button
            onClick={() => setIsChatOpen(false)}
            className="p-1.5 rounded-lg text-[var(--color-gray-500)] hover:text-[var(--color-gray-700)] hover:bg-[var(--color-gray-200)] transition-colors"
            title="Close chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-[var(--color-gray-700)] font-medium mb-2">How can I help?</p>
              <p className="text-sm text-[var(--color-gray-500)] mb-4">
                Tell me what you&apos;d like to change about your dashboard
              </p>
              <div className="space-y-2">
                {[
                  'Make the header more prominent',
                  'Add a chart showing trends over time',
                  'Change the color scheme to blue',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setChatInput(suggestion)}
                    className="block w-full text-left px-3 py-2 text-sm text-[var(--color-gray-600)] bg-[var(--color-gray-50)] hover:bg-[var(--color-gray-100)] rounded-lg transition-colors"
                  >
                    &ldquo;{suggestion}&rdquo;
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
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
              <div className="bg-[var(--color-gray-100)] rounded-2xl px-4 py-3">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-[var(--color-gray-400)] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[var(--color-gray-400)] rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="w-2 h-2 bg-[var(--color-gray-400)] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form onSubmit={handleChatSubmit} className="p-4 border-t border-[var(--color-gray-200)] bg-white">
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Describe a change..."
              disabled={isChatLoading || !isComplete}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isChatLoading || !chatInput.trim() || !isComplete}
              className="flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Button>
          </div>
        </form>
      </div>

      {/* Overlay when chat is open on mobile */}
      {isChatOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
}
