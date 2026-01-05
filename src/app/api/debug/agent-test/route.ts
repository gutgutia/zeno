import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      cwd: process.cwd(),
      platform: process.platform,
      nodeVersion: process.version,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasE2BKey: !!process.env.E2B_API_KEY,
    },
  };

  // Find cli.js
  const possiblePaths = [
    '/app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js',
    path.join(process.cwd(), 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js'),
  ];

  let cliPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      cliPath = p;
      break;
    }
  }

  results.cliPath = cliPath;

  if (!cliPath) {
    results.error = 'cli.js not found';
    return NextResponse.json(results);
  }

  // Check file stats
  try {
    const stats = fs.statSync(cliPath);
    results.cliStats = {
      size: stats.size,
      mode: stats.mode.toString(8),
      isFile: stats.isFile(),
    };
  } catch (e) {
    results.cliStatsError = String(e);
  }

  // Try to run the CLI with --help or just check if node can load it
  try {
    // First just try to check if Node can parse the file
    const checkResult = execSync(`node -e "require('${cliPath}')" 2>&1`, {
      timeout: 10000,
      encoding: 'utf8',
      env: { ...process.env },
    });
    results.nodeLoadTest = { success: true, output: checkResult.slice(0, 500) };
  } catch (e: unknown) {
    const error = e as { status?: number; stdout?: string; stderr?: string; message?: string };
    results.nodeLoadTest = {
      success: false,
      exitCode: error.status,
      stdout: error.stdout?.slice(0, 500),
      stderr: error.stderr?.slice(0, 500),
      message: error.message?.slice(0, 500),
    };
  }

  return NextResponse.json(results, { status: 200 });
}
