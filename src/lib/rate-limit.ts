/**
 * Database-backed rate limiter for API endpoints.
 * Uses Supabase to persist rate limit data across serverless invocations.
 *
 * This ensures rate limiting works correctly in:
 * - Serverless environments (cold starts)
 * - Multi-instance deployments
 * - Edge functions
 */

import { createAdminClient } from '@/lib/supabase/admin';

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the rate limit resets */
  resetTime: number;
  /** Total limit for this window */
  limit: number;
}

/**
 * Check if a request should be rate limited using database-backed storage.
 *
 * @param identifier - Unique identifier for the client (e.g., IP address)
 * @param namespace - Namespace to separate different rate limit contexts (e.g., 'otp', 'api')
 * @param config - Rate limit configuration
 * @returns Rate limit result with allowed status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  namespace: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const key = `${namespace}:${identifier}`;
  const now = Date.now();
  const windowStart = new Date(now - config.windowMs).toISOString();

  // Count requests in the current window
  const { count, error } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gt('created_at', windowStart);

  if (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the request if we can't check
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      limit: config.maxRequests,
    };
  }

  const requestCount = count || 0;
  const allowed = requestCount < config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - requestCount - 1);

  // Record this request if allowed
  if (allowed) {
    await supabase.from('rate_limits').insert({
      key,
      created_at: new Date(now).toISOString(),
    });
  }

  // Clean up old entries periodically (1% chance per request to avoid overhead)
  if (Math.random() < 0.01) {
    const cleanupThreshold = new Date(now - config.windowMs * 2).toISOString();
    await supabase
      .from('rate_limits')
      .delete()
      .lt('created_at', cleanupThreshold);
  }

  return {
    allowed,
    remaining,
    resetTime: now + config.windowMs,
    limit: config.maxRequests,
  };
}

/**
 * Get the client IP address from a request.
 * Handles common proxy headers (X-Forwarded-For, X-Real-IP).
 *
 * @param request - The incoming request
 * @returns The client IP address, or 'unknown' if it cannot be determined
 */
export function getClientIP(request: Request): string {
  // Check X-Forwarded-For header (common for proxies/load balancers)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2, ...
    // The first one is the original client
    const firstIP = forwardedFor.split(',')[0].trim();
    if (firstIP) return firstIP;
  }

  // Check X-Real-IP header (used by some proxies like nginx)
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP.trim();
  }

  // Fallback: try to get from connection info (not available in all environments)
  return 'unknown';
}
