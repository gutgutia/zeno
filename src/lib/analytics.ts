/**
 * Analytics Event Tracking
 *
 * Centralized analytics events for Zeno.
 * Uses PostHog under the hood but provides a typed interface.
 */

import { trackEvent } from './posthog';

// ============================================
// Dashboard Events
// ============================================

export function trackDashboardCreated(properties: {
  dashboardId: string;
  dataSource: 'csv' | 'excel' | 'paste' | 'google_sheets';
  rowCount: number;
  columnCount: number;
}) {
  trackEvent('dashboard_created', properties);
}

export function trackDashboardGenerated(properties: {
  dashboardId: string;
  creditsUsed: number;
  generationTimeMs: number;
  inputTokens?: number;
  outputTokens?: number;
}) {
  trackEvent('dashboard_generated', properties);
}

export function trackDashboardModified(properties: {
  dashboardId: string;
  creditsUsed: number;
  modificationTimeMs: number;
}) {
  trackEvent('dashboard_modified', properties);
}

export function trackDashboardRefreshed(properties: {
  dashboardId: string;
  creditsUsed: number;
  refreshType: 'surgical' | 'regenerate';
  dataSource: 'upload' | 'google_sheets';
}) {
  trackEvent('dashboard_refreshed', properties);
}

export function trackDashboardDeleted(properties: {
  dashboardId: string;
  permanent: boolean;
}) {
  trackEvent('dashboard_deleted', properties);
}

export function trackDashboardRestored(properties: {
  dashboardId: string;
}) {
  trackEvent('dashboard_restored', properties);
}

// ============================================
// Sharing Events
// ============================================

export function trackDashboardShared(properties: {
  dashboardId: string;
  shareType: 'public' | 'private';
  hasPassword: boolean;
}) {
  trackEvent('dashboard_shared', properties);
}

export function trackDashboardViewed(properties: {
  dashboardId: string;
  viewType: 'owner' | 'shared' | 'public';
}) {
  trackEvent('dashboard_viewed', properties);
}

// ============================================
// Data Upload Events
// ============================================

export function trackDataUploaded(properties: {
  source: 'csv' | 'excel' | 'paste' | 'google_sheets';
  rowCount: number;
  columnCount: number;
  fileSizeBytes?: number;
}) {
  trackEvent('data_uploaded', properties);
}

export function trackGoogleSheetsConnected(properties: {
  spreadsheetId: string;
  sheetCount: number;
}) {
  trackEvent('google_sheets_connected', properties);
}

// ============================================
// Billing Events
// ============================================

export function trackUpgradeStarted(properties: {
  currentPlan: string;
  targetPlan: string;
  source: 'dashboard_limit' | 'credit_limit' | 'feature_gate' | 'settings';
}) {
  trackEvent('upgrade_started', properties);
}

export function trackCreditsPurchased(properties: {
  amount: number;
  credits: number;
  source: 'low_balance' | 'settings' | 'generation_prompt';
}) {
  trackEvent('credits_purchased', properties);
}

export function trackSubscriptionChanged(properties: {
  previousPlan: string;
  newPlan: string;
  action: 'upgrade' | 'downgrade' | 'cancel';
}) {
  trackEvent('subscription_changed', properties);
}

// ============================================
// Authentication Events
// ============================================

export function trackSignupStarted(properties: {
  method: 'email' | 'google';
}) {
  trackEvent('signup_started', properties);
}

export function trackSignupCompleted(properties: {
  method: 'email' | 'google';
  userId: string;
}) {
  trackEvent('signup_completed', properties);
}

export function trackLoginCompleted(properties: {
  method: 'email' | 'google';
  userId: string;
}) {
  trackEvent('login_completed', properties);
}

// ============================================
// Error Events
// ============================================

export function trackGenerationFailed(properties: {
  dashboardId: string;
  errorType: string;
  errorMessage: string;
}) {
  trackEvent('generation_failed', properties);
}

export function trackApiError(properties: {
  endpoint: string;
  statusCode: number;
  errorMessage: string;
}) {
  trackEvent('api_error', properties);
}

// ============================================
// Feature Usage Events
// ============================================

export function trackFeatureUsed(properties: {
  feature: string;
  context?: string;
}) {
  trackEvent('feature_used', properties);
}

export function trackChatMessageSent(properties: {
  dashboardId: string;
  messageLength: number;
}) {
  trackEvent('chat_message_sent', properties);
}
