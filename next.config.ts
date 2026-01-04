import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep claude-agent-sdk as external to preserve the cli.js file
  // This prevents Next.js from bundling it and losing the executable
  serverExternalPackages: [
    '@anthropic-ai/claude-agent-sdk',
    '@e2b/code-interpreter',
  ],
};

export default nextConfig;
