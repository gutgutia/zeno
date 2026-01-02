# Google Sheets Integration - Implementation Plan

## Overview

Add the ability for users to connect a Google Sheet as a data source, with:
1. **Initial import** - Pull data from Google Sheets to create a dashboard
2. **On-demand refresh** - User clicks "Refresh" to update with latest data
3. **Daily polling** - Automatic daily sync to detect and apply updates
4. **Smart data refresh** - Use Agent SDK to update values while preserving dashboard layout

---

## Architecture Understanding

### Current System
- **Agent SDK** orchestrates multi-turn dashboard generation
- **E2B Python sandbox** computes exact values from raw data
- **Self-contained HTML** - all values baked in (no separate data layer)
- **Extended thinking** enabled for reasoning about data

### Key Insight for Data Refresh
Since values are embedded in HTML, a "data refresh" requires:
1. Fetching new data from Google Sheets
2. Using the Agent SDK to intelligently update the HTML with new values
3. Preserving the dashboard structure, layout, and design

This is NOT a simple data swap - it's a **smart regeneration** that respects the existing design.

---

## Implementation Phases

### Phase 1: Google OAuth & Connection (Foundation)

#### 1.1 Database Schema Changes

```sql
-- New table for Google OAuth connections
CREATE TABLE google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, google_email)
);

-- RLS policies
ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their workspace connections"
  ON google_connections FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Extend dashboards table for Google Sheets source
ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS
  google_sheet_id TEXT,
  google_sheet_range TEXT,
  google_connection_id UUID REFERENCES google_connections(id),
  last_synced_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT false;

-- Index for daily sync job
CREATE INDEX idx_dashboards_sync_enabled
  ON dashboards(sync_enabled, last_synced_at)
  WHERE sync_enabled = true;
```

#### 1.2 Google OAuth Flow

**Files to create:**
- `src/app/api/auth/google/route.ts` - Initiate OAuth
- `src/app/api/auth/google/callback/route.ts` - Handle callback
- `src/lib/google/auth.ts` - Token management utilities

**OAuth Scopes needed:**
```typescript
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly', // For listing sheets
  'https://www.googleapis.com/auth/userinfo.email',
];
```

**Environment variables:**
```bash
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://app.zeno.com/api/auth/google/callback
```

#### 1.3 Token Refresh Logic

```typescript
// src/lib/google/auth.ts
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const connection = await getConnection(connectionId);

  if (new Date(connection.token_expires_at) > new Date()) {
    return connection.access_token;
  }

  // Refresh the token
  const tokens = await refreshGoogleToken(connection.refresh_token);
  await updateConnection(connectionId, tokens);
  return tokens.access_token;
}
```

---

### Phase 2: Google Sheets API Integration

#### 2.1 Sheets Reading Service

**File:** `src/lib/google/sheets.ts`

```typescript
import { google } from 'googleapis';

export async function fetchSheetData(
  accessToken: string,
  spreadsheetId: string,
  range?: string
): Promise<{ data: string; metadata: SheetMetadata }> {
  const sheets = google.sheets({ version: 'v4', auth: accessToken });

  // Get spreadsheet metadata
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });

  // Determine range (default to first sheet, all data)
  const effectiveRange = range || `${metadata.data.sheets[0].properties.title}`;

  // Fetch data
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: effectiveRange,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  // Convert to CSV format (compatible with existing parser)
  const csv = convertToCSV(response.data.values);

  return {
    data: csv,
    metadata: {
      title: metadata.data.properties.title,
      sheetName: effectiveRange.split('!')[0],
      rowCount: response.data.values?.length || 0,
      lastModified: metadata.data.properties.modifiedTime,
    },
  };
}

export async function listUserSheets(accessToken: string): Promise<SheetListItem[]> {
  const drive = google.drive({ version: 'v3', auth: accessToken });

  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name, modifiedTime, owners)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });

  return response.data.files;
}
```

#### 2.2 Sheet Selection UI

**File:** `src/components/google-sheets/SheetPicker.tsx`

Modal component that:
1. Shows list of user's Google Sheets (from Drive API)
2. Allows selecting a specific sheet/tab
3. Optional: specify a range (A1:Z100)
4. Preview first few rows before confirming

---

### Phase 3: Dashboard Creation from Google Sheets

#### 3.1 New Dashboard Creation Flow

**Update:** `src/app/dashboards/new/page.tsx`

Add third option alongside "Paste" and "Upload":
- **Connect Google Sheet** button
- Opens OAuth flow if not connected
- Shows SheetPicker if already connected
- On selection, fetches data and proceeds to dashboard creation

#### 3.2 Data Source Tracking

```typescript
// When creating dashboard from Google Sheets
const dashboard = await supabase.from('dashboards').insert({
  // ... existing fields
  data_source: {
    type: 'google_sheets',
    spreadsheet_id: selectedSheet.id,
    spreadsheet_name: selectedSheet.name,
    range: selectedRange,
  },
  google_sheet_id: selectedSheet.id,
  google_sheet_range: selectedRange,
  google_connection_id: connectionId,
  sync_enabled: true, // Enable daily sync by default
});
```

---

### Phase 4: Smart Data Refresh (Key Innovation)

This is the critical piece - using Agent SDK to update dashboards intelligently.

#### 4.1 Refresh Agent Prompt

**File:** `src/lib/ai/refresh-prompts.ts`

```typescript
export function getRefreshSystemPrompt(branding: BrandingConfig | null): string {
  return `You are a dashboard refresh agent. Your job is to UPDATE an existing dashboard with new data while PRESERVING its structure, layout, and design.

## CRITICAL RULES

1. **PRESERVE STRUCTURE**: The dashboard layout, chart types, sections, and overall design must remain IDENTICAL
2. **UPDATE VALUES ONLY**: Only the data values, numbers, percentages, and chart data should change
3. **MAINTAIN CONSISTENCY**: Colors, fonts, styling, and branding must stay the same
4. **HANDLE SCHEMA CHANGES**: If the new data has different columns:
   - If columns are ADDED: Ignore them (don't add new charts)
   - If columns are REMOVED: Keep the chart but show "Data unavailable"
   - If column NAMES changed: Try to match by similarity, ask if uncertain

## YOUR WORKFLOW

1. Read the existing dashboard HTML to understand its structure
2. Read the new data from /tmp/data.txt
3. Use Python to compute the updated values for each metric/chart
4. Generate updated HTML that is STRUCTURALLY IDENTICAL but with new values

## OUTPUT FORMAT

Return a JSON object:
{
  "html": "<updated HTML with new values>",
  "summary": "Brief description of what changed",
  "changes": [
    {"metric": "Total Revenue", "old": "$1.2M", "new": "$1.5M"},
    ...
  ],
  "warnings": ["Column 'region' was removed, chart shows placeholder"]
}

${branding ? `## BRANDING (preserve these exactly)
${JSON.stringify(branding, null, 2)}` : ''}
`;
}

export function getRefreshUserPrompt(
  existingHtml: string,
  previousSummary?: string
): string {
  return `## EXISTING DASHBOARD

Here is the current dashboard HTML that you must preserve structurally:

\`\`\`html
${existingHtml}
\`\`\`

${previousSummary ? `## PREVIOUS DATA SUMMARY
${previousSummary}` : ''}

## YOUR TASK

1. The new data has been written to /tmp/data.txt
2. Analyze the new data using Python
3. Compute updated values for all metrics and charts
4. Return the updated HTML with new values, keeping structure identical

Remember: Users expect their dashboard to look the SAME, just with fresh numbers.`;
}
```

#### 4.2 Refresh Agent Function

**File:** `src/lib/ai/agent.ts` (add to existing file)

```typescript
export async function refreshDashboardWithAgent(
  newRawContent: string,
  existingConfig: DashboardConfig,
  branding: BrandingConfig | null
): Promise<RefreshResult> {
  let activeSandbox: Sandbox | null = null;

  try {
    // Create sandbox and write new data
    activeSandbox = await Sandbox.create({ timeoutMs: 300000 });
    await activeSandbox.files.write('/tmp/data.txt', newRawContent);

    // Also write existing HTML for reference
    await activeSandbox.files.write('/tmp/existing.html', existingConfig.html);

    const systemPrompt = getRefreshSystemPrompt(branding);
    const userPrompt = getRefreshUserPrompt(
      existingConfig.html,
      existingConfig.metadata?.summary
    );

    const result = await query({
      model: 'claude-opus-4-5-20251101',
      systemPrompt,
      userPrompt,
      mcpServers: [pythonToolServer],
      allowedTools: ['mcp__python__execute_python'],
      maxTurns: 10, // Fewer turns needed for refresh
      thinking: AGENT_CONFIG.extendedThinking ? {
        type: 'enabled',
        budget_tokens: 5000, // Less thinking needed
      } : undefined,
    });

    // Parse result
    const jsonMatch = result.match(/\{[\s\S]*"html"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract refresh result');
    }

    const refreshResult = JSON.parse(jsonMatch[0]) as RefreshResult;
    return refreshResult;

  } finally {
    if (activeSandbox) {
      await activeSandbox.kill();
    }
  }
}
```

#### 4.3 Refresh API Endpoint

**File:** `src/app/api/dashboards/[id]/refresh/route.ts`

```typescript
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  // Get dashboard with Google Sheets connection
  const dashboard = await getDashboardWithConnection(id);

  if (!dashboard.google_connection_id || !dashboard.google_sheet_id) {
    return NextResponse.json(
      { error: 'Dashboard is not connected to Google Sheets' },
      { status: 400 }
    );
  }

  // Get fresh access token
  const accessToken = await getValidAccessToken(dashboard.google_connection_id);

  // Fetch latest data from Google Sheets
  const { data: newContent, metadata } = await fetchSheetData(
    accessToken,
    dashboard.google_sheet_id,
    dashboard.google_sheet_range
  );

  // Update status
  await updateDashboard(id, { generation_status: 'refreshing' });

  // Smart refresh using Agent SDK
  const refreshResult = await refreshDashboardWithAgent(
    newContent,
    dashboard.config,
    dashboard.effective_branding
  );

  // Update dashboard with new HTML
  const updatedConfig: DashboardConfig = {
    ...dashboard.config,
    html: refreshResult.html,
    metadata: {
      ...dashboard.config.metadata,
      lastRefreshedAt: new Date().toISOString(),
      refreshSummary: refreshResult.summary,
    },
  };

  await updateDashboard(id, {
    config: updatedConfig,
    raw_content: newContent,
    last_synced_at: new Date().toISOString(),
    generation_status: 'completed',
  });

  return NextResponse.json({
    success: true,
    changes: refreshResult.changes,
    warnings: refreshResult.warnings,
  });
}
```

---

### Phase 5: Daily Polling Sync

#### 5.1 Sync Cron Job

**Option A: Vercel Cron (if deployed on Vercel)**

**File:** `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-google-sheets",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**File:** `src/app/api/cron/sync-google-sheets/route.ts`

```typescript
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get dashboards due for sync (sync_enabled = true, last_synced > 24h ago)
  const dashboards = await getDashboardsDueForSync();

  const results = [];
  for (const dashboard of dashboards) {
    try {
      // Check if data actually changed
      const { data, metadata } = await fetchSheetData(
        await getValidAccessToken(dashboard.google_connection_id),
        dashboard.google_sheet_id,
        dashboard.google_sheet_range
      );

      // Simple change detection: compare content hash
      const newHash = hashContent(data);
      const oldHash = hashContent(dashboard.raw_content);

      if (newHash !== oldHash) {
        // Data changed, trigger refresh
        await triggerRefresh(dashboard.id);
        results.push({ id: dashboard.id, status: 'refreshed' });
      } else {
        // Just update last_synced_at
        await updateDashboard(dashboard.id, { last_synced_at: new Date() });
        results.push({ id: dashboard.id, status: 'unchanged' });
      }
    } catch (error) {
      results.push({ id: dashboard.id, status: 'error', error: error.message });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
```

**Option B: External Cron Service**

Use services like:
- Inngest
- Trigger.dev
- QStash (Upstash)
- GitHub Actions scheduled workflow

---

### Phase 6: UI Components

#### 6.1 Google Connection UI

**File:** `src/components/google-sheets/ConnectButton.tsx`

```typescript
export function GoogleConnectButton({ workspaceId }: { workspaceId: string }) {
  const { data: connection } = useGoogleConnection(workspaceId);

  if (connection) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle className="text-green-500" />
        <span>Connected as {connection.google_email}</span>
        <Button variant="ghost" onClick={disconnect}>Disconnect</Button>
      </div>
    );
  }

  return (
    <Button onClick={() => initiateOAuth(workspaceId)}>
      <GoogleIcon /> Connect Google Account
    </Button>
  );
}
```

#### 6.2 Dashboard Refresh Controls

**File:** `src/components/dashboard/RefreshControls.tsx`

```typescript
export function RefreshControls({ dashboard }: { dashboard: Dashboard }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { mutate: refresh } = useRefreshDashboard();

  if (dashboard.data_source?.type !== 'google_sheets') {
    return null; // Only show for Google Sheets dashboards
  }

  return (
    <div className="flex items-center gap-4">
      <div className="text-sm text-muted-foreground">
        Last synced: {formatRelative(dashboard.last_synced_at)}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => refresh(dashboard.id)}
        disabled={isRefreshing}
      >
        <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
        Refresh Data
      </Button>

      <SyncToggle
        enabled={dashboard.sync_enabled}
        onToggle={(enabled) => updateSyncSetting(dashboard.id, enabled)}
      />
    </div>
  );
}
```

#### 6.3 New Dashboard Page Updates

**File:** `src/app/dashboards/new/page.tsx`

Add new data source option:
```typescript
<div className="grid grid-cols-3 gap-4">
  <DataSourceCard
    icon={<ClipboardPaste />}
    title="Paste Data"
    description="Paste CSV, JSON, or text directly"
    onClick={() => setSource('paste')}
  />
  <DataSourceCard
    icon={<Upload />}
    title="Upload File"
    description="Upload CSV, Excel, or text files"
    onClick={() => setSource('upload')}
  />
  <DataSourceCard
    icon={<Sheet />}
    title="Google Sheets"
    description="Connect to a live Google Sheet"
    onClick={() => setSource('google_sheets')}
    badge="Live sync"
  />
</div>
```

---

## File Structure Summary

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── google/
│   │   │       ├── route.ts          # Initiate OAuth
│   │   │       └── callback/
│   │   │           └── route.ts      # OAuth callback
│   │   ├── dashboards/
│   │   │   └── [id]/
│   │   │       └── refresh/
│   │   │           └── route.ts      # Refresh endpoint
│   │   └── cron/
│   │       └── sync-google-sheets/
│   │           └── route.ts          # Daily sync job
│   └── dashboards/
│       └── new/
│           └── page.tsx              # Updated with Google Sheets option
├── components/
│   └── google-sheets/
│       ├── ConnectButton.tsx         # OAuth connection button
│       ├── SheetPicker.tsx           # Sheet selection modal
│       └── RefreshControls.tsx       # Refresh UI in dashboard
├── lib/
│   ├── google/
│   │   ├── auth.ts                   # Token management
│   │   └── sheets.ts                 # Sheets API wrapper
│   └── ai/
│       ├── agent.ts                  # Add refreshDashboardWithAgent()
│       └── refresh-prompts.ts        # Refresh-specific prompts
└── types/
    └── google.ts                     # Google-related types
```

---

## Environment Variables

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-app.com/api/auth/google/callback

# Cron authentication
CRON_SECRET=your-secure-cron-secret
```

---

## Implementation Order

1. **Phase 1**: Database schema + Google OAuth (2-3 days)
2. **Phase 2**: Sheets API integration (1-2 days)
3. **Phase 3**: Dashboard creation from Sheets (1-2 days)
4. **Phase 4**: Smart refresh with Agent SDK (2-3 days)
5. **Phase 5**: Daily polling cron (1 day)
6. **Phase 6**: UI components (2 days)

**Total: ~10-12 days**

---

## Testing Checklist

- [ ] OAuth flow works (connect, disconnect, token refresh)
- [ ] Can list user's Google Sheets
- [ ] Can fetch data from selected sheet
- [ ] Dashboard creation from Google Sheets works
- [ ] Manual refresh updates values correctly
- [ ] Dashboard structure preserved after refresh
- [ ] Daily sync detects changes correctly
- [ ] Daily sync skips unchanged sheets
- [ ] Error handling for revoked access
- [ ] Error handling for deleted sheets
- [ ] UI shows sync status correctly

---

## Security Considerations

1. **Token Storage**: Encrypt refresh tokens at rest
2. **Scope Limitation**: Request only readonly access
3. **RLS Policies**: Ensure users can only access their own connections
4. **Token Refresh**: Handle expired tokens gracefully
5. **Rate Limiting**: Respect Google API quotas
6. **Audit Logging**: Log all sync operations

---

## Future Enhancements

1. **Selective Sheet Ranges**: Let users pick specific ranges to sync
2. **Multi-Sheet Support**: Combine data from multiple sheets
3. **Webhook Alternative**: Offer Apps Script webhook option for real-time updates
4. **Sync History**: Show log of all sync operations
5. **Conflict Resolution**: Handle manual edits + sync conflicts
6. **Other Integrations**: Airtable, Notion, Excel Online
