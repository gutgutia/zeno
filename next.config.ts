import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure claude-agent-sdk cli.js is included in the serverless function
  outputFileTracingIncludes: {
    '/api/dashboards/[id]/generate': [
      './node_modules/@anthropic-ai/claude-agent-sdk/**/*',
    ],
    '/api/dashboards/[id]/refresh': [
      './node_modules/@anthropic-ai/claude-agent-sdk/**/*',
    ],
  },
};

export default nextConfig;
