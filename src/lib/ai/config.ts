/**
 * Centralized configuration for AI/Agent settings
 *
 * Settings can be changed via the admin panel (Settings > AI Config)
 * Changes take effect immediately without redeploying.
 */

import { createServiceClient } from '@/lib/supabase/service';

export interface AIConfigType {
  generateModel: 'sonnet' | 'opus' | 'haiku';
  modifyModel: 'sonnet' | 'opus' | 'haiku';
  refreshModel: 'sonnet' | 'opus' | 'haiku';
  sandboxTemplate: 'node' | 'python';
  promptStyle: 'enhanced' | 'minimal';
  verboseLogging: boolean;
  sandboxTimeoutMs: number;
  commandTimeoutMs: number;
  // Approach toggles
  useDirectModify: boolean;  // true = try direct first, false = always use agentic
  useDirectRefresh: boolean; // true = try direct first, false = always use agentic
}

/**
 * Default configuration values (used as fallback if database fetch fails)
 */
export const DEFAULT_AI_CONFIG: AIConfigType = {
  generateModel: 'opus',
  modifyModel: 'sonnet',
  refreshModel: 'sonnet',
  sandboxTemplate: 'python',
  promptStyle: 'enhanced',
  verboseLogging: true,
  sandboxTimeoutMs: 480000, // 8 minutes
  commandTimeoutMs: 420000, // 7 minutes
  useDirectModify: true,    // Try direct approach first for modifications
  useDirectRefresh: true,   // Try direct approach first for refresh
};

// Cache for the config to avoid fetching on every call
let cachedConfig: AIConfigType | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Fetch AI config from the database
 * Returns cached value if still valid, otherwise fetches fresh
 */
export async function getAIConfig(): Promise<AIConfigType> {
  const now = Date.now();

  // Return cached config if still valid
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    // Check if we have the required env vars
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[AI Config] Missing Supabase env vars, using defaults');
      return DEFAULT_AI_CONFIG;
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'ai_config')
      .single();

    if (error || !data) {
      console.warn('[AI Config] Failed to fetch from database, using defaults:', error?.message);
      return DEFAULT_AI_CONFIG;
    }

    // Merge with defaults to ensure all fields are present
    const dbConfig = data.value as Partial<AIConfigType>;
    cachedConfig = {
      ...DEFAULT_AI_CONFIG,
      ...dbConfig,
    };
    cacheTimestamp = now;

    return cachedConfig;
  } catch (err) {
    console.error('[AI Config] Error fetching config:', err);
    return DEFAULT_AI_CONFIG;
  }
}

/**
 * Clear the config cache (useful after admin updates)
 */
export function clearAIConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Synchronous access to config (uses cached value or defaults)
 * Use this when you can't await, but prefer getAIConfig() when possible
 */
export const AI_CONFIG: AIConfigType = DEFAULT_AI_CONFIG;

/**
 * Initialize the config cache (call this at app startup if desired)
 */
export async function initAIConfig(): Promise<void> {
  await getAIConfig();
}
