#!/usr/bin/env npx ts-node

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile(filename: string) {
  const filepath = resolve(process.cwd(), filename);
  if (!existsSync(filepath)) return;
  const content = readFileSync(filepath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const dashboardId = process.argv[2];
  if (!dashboardId) {
    console.error('Usage: npx tsx scripts/fetch-dashboard.ts <dashboard-id>');
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('dashboards')
    .select('*')
    .eq('id', dashboardId)
    .single();

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('Dashboard:', data.title);
  console.log('Status:', data.generation_status);
  console.log('Created:', data.created_at);

  if (data.config?.html) {
    const outputPath = resolve(process.cwd(), 'test-data', `agent-generated-${dashboardId.slice(0, 8)}.html`);
    writeFileSync(outputPath, data.config.html);
    console.log('\nHTML saved to:', outputPath);
    console.log('HTML length:', data.config.html.length, 'chars');
  } else {
    console.log('\nNo HTML in config');
    console.log('Config:', JSON.stringify(data.config, null, 2));
  }
}

main().catch(console.error);
