/**
 * Build E2B Templates
 *
 * Usage:
 *   npx tsx e2b/build.ts              # Build the Node.js template (default)
 *   npx tsx e2b/build.ts node         # Build the Node.js template
 *   npx tsx e2b/build.ts python       # Build the Python template
 *   npx tsx e2b/build.ts all          # Build both templates
 *
 * Prerequisites:
 * - E2B_API_KEY environment variable set
 * - e2b CLI authenticated (e2b auth login)
 */

import { Template, defaultBuildLogger } from 'e2b';
import { templateNode, templatePython, TEMPLATE_ALIASES, type TemplateType } from './template';

async function buildTemplate(type: TemplateType) {
  const template = type === 'node' ? templateNode : templatePython;
  const alias = TEMPLATE_ALIASES[type];

  console.log(`\n🚀 Building E2B template: ${alias}...\n`);

  const result = await Template.build(template, {
    alias,
    cpuCount: 2,
    memoryMB: 2048,
    onBuildLogs: defaultBuildLogger(),
  });

  console.log(`\n✅ Template "${alias}" built successfully!`);
  console.log(`   Template ID: ${result.templateId}`);
  console.log(`   Alias: ${alias}`);

  return result;
}

async function main() {
  if (!process.env.E2B_API_KEY) {
    console.error('❌ E2B_API_KEY environment variable is required');
    console.log('\nTo get your API key:');
    console.log('1. Go to https://e2b.dev/dashboard');
    console.log('2. Copy your API key from Account Settings');
    console.log('3. Set it: export E2B_API_KEY=your_key_here');
    process.exit(1);
  }

  const arg = process.argv[2] || 'node';

  try {
    if (arg === 'all') {
      console.log('Building all templates...');
      await buildTemplate('node');
      await buildTemplate('python');
      console.log('\n✅ All templates built successfully!');
    } else if (arg === 'node' || arg === 'python') {
      await buildTemplate(arg);
    } else {
      console.error(`❌ Unknown template type: ${arg}`);
      console.log('\nUsage:');
      console.log('  npx tsx e2b/build.ts node     # Build Node.js template');
      console.log('  npx tsx e2b/build.ts python   # Build Python template');
      console.log('  npx tsx e2b/build.ts all      # Build both templates');
      process.exit(1);
    }

    console.log('\nYou can now use these templates with:');
    console.log(`  Sandbox.create('${TEMPLATE_ALIASES.node}', { ... })    // Node.js`);
    console.log(`  Sandbox.create('${TEMPLATE_ALIASES.python}', { ... })  // Python`);

  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

main();
