/**
 * Build the E2B Claude Code template
 *
 * Run with: npx tsx e2b/build.ts
 *
 * Prerequisites:
 * - E2B_API_KEY environment variable set
 * - e2b CLI authenticated (e2b auth login)
 */

import { Template, defaultBuildLogger } from 'e2b';
import { template } from './template';

async function build() {
  console.log('🚀 Building E2B Claude Code template...\n');

  if (!process.env.E2B_API_KEY) {
    console.error('❌ E2B_API_KEY environment variable is required');
    console.log('\nTo get your API key:');
    console.log('1. Go to https://e2b.dev/dashboard');
    console.log('2. Copy your API key from Account Settings');
    console.log('3. Set it: export E2B_API_KEY=your_key_here');
    process.exit(1);
  }

  try {
    // Use a unique alias for your account
    const alias = 'zeno-claude-code';

    const result = await Template.build(template, {
      alias,
      cpuCount: 2,
      memoryMB: 2048,
      onBuildLogs: defaultBuildLogger(),
    });

    console.log('\n✅ Template built successfully!');
    console.log(`   Template ID: ${result.templateId}`);
    console.log(`   Alias: ${alias}`);
    console.log('\nYou can now use this template with:');
    console.log(`   Sandbox.create('${alias}', { ... })`);

  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

build();
