import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these packages
  // The Agent SDK uses subprocess spawning which breaks if bundled
  serverExternalPackages: [
    '@anthropic-ai/claude-agent-sdk',
    '@e2b/code-interpreter',
  ],
};

export default nextConfig;
