/**
 * Simple in-memory rate limiter for API endpoints.
 * Tracks requests by identifier (typically IP address) with configurable limits.
 *
 * Note: This is suitable for single-instance deployments.
 * For multi-instance deployments, consider using Redis or a similar distributed store.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval to prevent memory leaks (runs every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent Node from exiting
  cleanupInterval.unref();
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
 * Check if a request should be rate limited.
 *
 * @param identifier - Unique identifier for the client (e.g., IP address, user ID)
 * @param namespace - Namespace to separate different rate limit contexts (e.g., 'otp', 'api')
 * @param config - Rate limit configuration
 * @returns Rate limit result with allowed status and metadata
 *
 * @example
 * ```ts
 * const result = checkRateLimit(clientIP, 'otp', { maxRequests: 10, windowMs: 5 * 60 * 1000 });
 * if (!result.allowed) {
 *   return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 * }
 * ```
 */
export function checkRateLimit(
  identifier: string,
  namespace: string,
  config: RateLimitConfig
): RateLimitResult {
  startCleanup();

  const key = `${namespace}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // If no entry exists or the window has expired, create a new one
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
  }

  // Increment the request count
  entry.count++;
  rateLimitStore.set(key, entry);

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
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
