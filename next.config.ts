import type { NextConfig } from "next";

// Security headers to protect against common web attacks
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://accounts.google.com https://*.posthog.com https://us-assets.i.posthog.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://accounts.google.com https://*.posthog.com https://us.i.posthog.com https://us-assets.i.posthog.com",
      "frame-src 'self' https://js.stripe.com https://accounts.google.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Disable X-Powered-By header to reduce information disclosure
  poweredByHeader: false,
  // Prevent Next.js from bundling these packages
  // The Agent SDK uses subprocess spawning which breaks if bundled
  // e2b uses ESM-only dependencies (chalk) that can't be require()'d
  serverExternalPackages: [
    '@anthropic-ai/claude-agent-sdk',
    '@e2b/code-interpreter',
    'e2b',
    'chalk',  // ESM-only, used by e2b
  ],

  // Ensure the Agent SDK and e2b files are included in the server output
  // This is needed because the SDK spawns cli.js as a subprocess
  outputFileTracingIncludes: {
    '/api/dashboards/[id]/generate': [
      './node_modules/@anthropic-ai/claude-agent-sdk/**/*',
      './node_modules/@e2b/**/*',
      './node_modules/e2b/**/*',
    ],
    '/api/dashboards/[id]/refresh': [
      './node_modules/@anthropic-ai/claude-agent-sdk/**/*',
      './node_modules/@e2b/**/*',
      './node_modules/e2b/**/*',
    ],
    '/api/cron/sync-google-sheets': [
      './node_modules/@anthropic-ai/claude-agent-sdk/**/*',
      './node_modules/@e2b/**/*',
      './node_modules/e2b/**/*',
    ],
  },

  // Apply security headers to all routes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
