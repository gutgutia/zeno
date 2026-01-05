import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these packages
  // The Agent SDK uses subprocess spawning which breaks if bundled
  serverExternalPackages: [
    '@anthropic-ai/claude-agent-sdk',
    '@e2b/code-interpreter',
  ],

  // Ensure the Agent SDK files are included in the server output
  // This is needed because the SDK spawns cli.js as a subprocess
  outputFileTracingIncludes: {
    '/api/dashboards/[id]/generate': ['./node_modules/@anthropic-ai/claude-agent-sdk/**/*'],
    '/api/dashboards/[id]/refresh': ['./node_modules/@anthropic-ai/claude-agent-sdk/**/*'],
    '/api/cron/sync-google-sheets': ['./node_modules/@anthropic-ai/claude-agent-sdk/**/*'],
  },
};

export default nextConfig;
