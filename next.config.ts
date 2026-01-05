import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
