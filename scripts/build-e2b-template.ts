/**
 * Build the E2B template with Claude Code pre-installed
 *
 * This script creates a custom E2B sandbox template that has:
 * - Node.js 24
 * - Claude Code CLI globally installed
 * - Required system dependencies (curl, git, ripgrep)
 *
 * Run this once to set up the template:
 *   npx tsx scripts/build-e2b-template.ts
 *
 * Prerequisites:
 *   1. Install E2B CLI: npm install -g @e2b/cli
 *   2. Login to E2B: e2b auth login
 *   3. Have E2B_API_KEY in your environment
 */

import { Sandbox } from 'e2b';

const TEMPLATE_NAME = 'claude-code';

async function buildTemplate() {
  console.log('🚀 Building E2B template with Claude Code...\n');

  // Check for E2B API key
  if (!process.env.E2B_API_KEY) {
    console.error('❌ E2B_API_KEY environment variable is required');
    console.log('\nTo get your API key:');
    console.log('1. Go to https://e2b.dev/dashboard');
    console.log('2. Copy your API key');
    console.log('3. Set it: export E2B_API_KEY=your_key_here');
    process.exit(1);
  }

  console.log('📦 Creating base sandbox...');

  // Create a sandbox to set up the template
  const sandbox = await Sandbox.create({
    timeoutMs: 600000, // 10 minutes for setup
  });

  try {
    console.log('📥 Installing system dependencies...');
    await sandbox.commands.run('apt-get update && apt-get install -y curl git ripgrep', {
      timeoutMs: 120000,
    });

    console.log('📥 Installing Node.js 24...');
    await sandbox.commands.run(
      'curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs',
      { timeoutMs: 180000 }
    );

    console.log('📥 Installing Claude Code CLI...');
    const installResult = await sandbox.commands.run(
      'npm install -g @anthropic-ai/claude-code@latest',
      { timeoutMs: 180000 }
    );

    if (installResult.exitCode !== 0) {
      console.error('❌ Failed to install Claude Code:', installResult.stderr);
      process.exit(1);
    }

    console.log('✅ Claude Code installed successfully');

    // Verify installation
    console.log('🔍 Verifying installation...');
    const versionResult = await sandbox.commands.run('claude --version', {
      timeoutMs: 30000,
    });
    console.log('   Claude version:', versionResult.stdout.trim());

    // Save as template
    console.log(`\n💾 Saving as template "${TEMPLATE_NAME}"...`);

    // Note: The E2B SDK doesn't have a direct "save as template" method
    // You need to use the E2B CLI for this:
    console.log('\n' + '='.repeat(60));
    console.log('IMPORTANT: Template setup complete in sandbox!');
    console.log('='.repeat(60));
    console.log('\nTo save this as a reusable template, you need to use the E2B CLI.');
    console.log('\nOption 1: Use E2B Dockerfile template (recommended)');
    console.log('Create a file: e2b.Dockerfile');
    console.log(`
FROM e2b/base:latest

# Install system dependencies
RUN apt-get update && apt-get install -y curl git ripgrep

# Install Node.js 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Verify installation
RUN claude --version
`);
    console.log('\nThen build with:');
    console.log(`  e2b template build --name ${TEMPLATE_NAME}`);
    console.log('\n' + '='.repeat(60));

  } finally {
    console.log('\n🧹 Cleaning up sandbox...');
    await sandbox.kill();
  }

  console.log('\n✅ Done!');
}

buildTemplate().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
