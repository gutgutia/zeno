/**
 * Script to replace a dashboard's HTML with imported HTML content
 * 
 * Usage:
 *   npx tsx scripts/import-dashboard-html.ts <dashboard-id> <html-file-path>
 * 
 * Prerequisites:
 *   1. User should have already created a dashboard via the normal Google Sheets flow
 *   2. This ensures the Google connection and sheet linkage is properly established
 *   3. We then replace the AI-generated HTML with the imported HTML
 * 
 * Example:
 *   npx tsx scripts/import-dashboard-html.ts abc123-def456 ./my-old-dashboard.html
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DashboardConfig {
  contentType: string;
  html: string;
  charts: Record<string, unknown>;
  metadata: {
    generatedAt: string;
    generationModel: string;
    agentGenerated?: boolean;
    importedAt?: string;
    originalSource?: string;
  };
  analysis?: {
    contentType: string;
    summary: string;
    insights: string[];
    suggestedVisualizations: string[];
  };
}

async function importDashboardHtml(dashboardId: string, htmlFilePath: string) {
  console.log(`\n📊 Importing HTML into dashboard: ${dashboardId}`);
  console.log(`📄 HTML file: ${htmlFilePath}\n`);

  // 1. Read the HTML file
  const absolutePath = path.resolve(htmlFilePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ HTML file not found: ${absolutePath}`);
    process.exit(1);
  }

  const htmlContent = fs.readFileSync(absolutePath, 'utf-8');
  console.log(`✅ Read HTML file (${htmlContent.length.toLocaleString()} characters)`);

  // 2. Fetch the existing dashboard
  const { data: dashboard, error: fetchError } = await supabase
    .from('dashboards')
    .select('*')
    .eq('id', dashboardId)
    .single();

  if (fetchError || !dashboard) {
    console.error(`❌ Dashboard not found: ${dashboardId}`);
    console.error(fetchError);
    process.exit(1);
  }

  console.log(`✅ Found dashboard: "${dashboard.title}"`);
  console.log(`   - Owner: ${dashboard.owner_id}`);
  console.log(`   - Google Sheet connected: ${dashboard.google_sheet_id ? 'Yes' : 'No'}`);
  if (dashboard.google_sheet_id) {
    console.log(`   - Sheet ID: ${dashboard.google_sheet_id}`);
    console.log(`   - Sync enabled: ${dashboard.sync_enabled}`);
  }

  // 3. Build the new config
  const existingConfig = dashboard.config as DashboardConfig | null;
  
  const newConfig: DashboardConfig = {
    contentType: existingConfig?.contentType || 'data',
    html: htmlContent,
    charts: {}, // No React chart placeholders - all inline
    metadata: {
      generatedAt: existingConfig?.metadata?.generatedAt || new Date().toISOString(),
      generationModel: 'manual-import',
      agentGenerated: false,
      importedAt: new Date().toISOString(),
      originalSource: path.basename(htmlFilePath),
    },
    analysis: existingConfig?.analysis || {
      contentType: 'data',
      summary: 'Imported dashboard',
      insights: [],
      suggestedVisualizations: [],
    },
  };

  // 4. Update the dashboard
  const { error: updateError } = await supabase
    .from('dashboards')
    .update({
      config: newConfig,
      generation_status: 'completed',
      generation_completed_at: new Date().toISOString(),
    })
    .eq('id', dashboardId);

  if (updateError) {
    console.error(`❌ Failed to update dashboard:`, updateError);
    process.exit(1);
  }

  console.log(`\n✅ Successfully imported HTML!`);
  console.log(`\n🔗 View dashboard at: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboards/${dashboardId}`);
}

// Alternative: Create a new dashboard from scratch with HTML
async function createDashboardWithHtml(
  userEmail: string,
  title: string,
  htmlFilePath: string,
  options?: {
    googleSheetId?: string;
    googleSheetName?: string;
    description?: string;
  }
) {
  console.log(`\n📊 Creating new dashboard for: ${userEmail}`);
  console.log(`📄 HTML file: ${htmlFilePath}\n`);

  // 1. Read the HTML file
  const absolutePath = path.resolve(htmlFilePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ HTML file not found: ${absolutePath}`);
    process.exit(1);
  }

  const htmlContent = fs.readFileSync(absolutePath, 'utf-8');
  console.log(`✅ Read HTML file (${htmlContent.length.toLocaleString()} characters)`);

  // 2. Find the user and their workspace
  const { data: userData, error: userError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', (
      await supabase.auth.admin.listUsers()
    ).data.users.find(u => u.email === userEmail)?.id)
    .single();

  // Alternative: query directly
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === userEmail);
  
  if (!user) {
    console.error(`❌ User not found: ${userEmail}`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email} (${user.id})`);

  // 3. Get their personal workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('owner_id', user.id)
    .eq('type', 'personal')
    .single();

  if (wsError || !workspace) {
    console.error(`❌ Workspace not found for user`);
    process.exit(1);
  }

  console.log(`✅ Found workspace: "${workspace.name}" (${workspace.id})`);

  // 4. If Google Sheet specified, find their Google connection
  let googleConnectionId: string | null = null;
  if (options?.googleSheetId) {
    const { data: connection } = await supabase
      .from('google_connections')
      .select('id, google_email')
      .eq('user_id', user.id)
      .single();

    if (connection) {
      googleConnectionId = connection.id;
      console.log(`✅ Found Google connection: ${connection.google_email}`);
    } else {
      console.warn(`⚠️  No Google connection found - dashboard won't have live sync`);
    }
  }

  // 5. Generate unique slug
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;

  // 6. Build config
  const config: DashboardConfig = {
    contentType: 'data',
    html: htmlContent,
    charts: {},
    metadata: {
      generatedAt: new Date().toISOString(),
      generationModel: 'manual-import',
      agentGenerated: false,
      importedAt: new Date().toISOString(),
      originalSource: path.basename(htmlFilePath),
    },
    analysis: {
      contentType: 'data',
      summary: options?.description || 'Imported dashboard',
      insights: [],
      suggestedVisualizations: [],
    },
  };

  // 7. Insert the dashboard
  const { data: dashboard, error: insertError } = await supabase
    .from('dashboards')
    .insert({
      workspace_id: workspace.id,
      owner_id: user.id,
      title,
      slug,
      description: options?.description,
      config,
      generation_status: 'completed',
      generation_completed_at: new Date().toISOString(),
      data_source: { type: options?.googleSheetId ? 'google_sheets' : 'manual' },
      is_published: false,
      // Google Sheets fields (if provided)
      google_connection_id: googleConnectionId,
      google_sheet_id: options?.googleSheetId || null,
      google_sheet_name: options?.googleSheetName || null,
      sync_enabled: !!options?.googleSheetId,
    })
    .select()
    .single();

  if (insertError) {
    console.error(`❌ Failed to create dashboard:`, insertError);
    process.exit(1);
  }

  console.log(`\n✅ Successfully created dashboard!`);
  console.log(`   - ID: ${dashboard.id}`);
  console.log(`   - Title: ${dashboard.title}`);
  console.log(`   - Slug: ${dashboard.slug}`);
  console.log(`\n🔗 View at: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboards/${dashboard.id}`);

  return dashboard;
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
Usage:
  
  Replace HTML in existing dashboard:
    npx tsx scripts/import-dashboard-html.ts replace <dashboard-id> <html-file>

  Create new dashboard from HTML:
    npx tsx scripts/import-dashboard-html.ts create <user-email> <title> <html-file> [google-sheet-id]

Examples:
  npx tsx scripts/import-dashboard-html.ts replace abc123 ./dashboard.html
  npx tsx scripts/import-dashboard-html.ts create user@example.com "Sales Dashboard" ./sales.html
  npx tsx scripts/import-dashboard-html.ts create user@example.com "Sales Dashboard" ./sales.html 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
`);
    process.exit(1);
  }

  const command = args[0];

  if (command === 'replace') {
    const [, dashboardId, htmlFile] = args;
    await importDashboardHtml(dashboardId, htmlFile);
  } else if (command === 'create') {
    const [, userEmail, title, htmlFile, googleSheetId] = args;
    await createDashboardWithHtml(userEmail, title, htmlFile, {
      googleSheetId,
    });
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch(console.error);

