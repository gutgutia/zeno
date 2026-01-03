# Dashboard Versioning & Data Updates - Implementation Plan

## Overview

Implement a versioning system for dashboards with two distinct update flows:
1. **Modify with AI** - Chat-based visual/content changes (minor versions)
2. **Update Data** - Refresh dashboard with new data (major versions)

## Versioning Scheme

```
Version X.Y
         │ │
         │ └── Minor: Visual/content modifications via AI chat
         └──── Major: Data updates/refreshes
```

Examples:
- `1.0` - Initial generation
- `1.1` - "Changed chart colors to blue"
- `1.2` - "Added summary section"
- `2.0` - "Updated with Q1 2024 data"
- `2.1` - "Fixed typo in title"

---

## Database Schema Changes

### New Table: `dashboard_versions`

```sql
CREATE TABLE dashboard_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,

  -- Version info
  major_version INTEGER NOT NULL DEFAULT 1,
  minor_version INTEGER NOT NULL DEFAULT 0,
  version_label VARCHAR(20) GENERATED ALWAYS AS (major_version || '.' || minor_version) STORED,

  -- Change metadata
  change_type VARCHAR(20) NOT NULL, -- 'initial', 'ai_modification', 'data_refresh'
  change_summary TEXT,              -- Auto-generated: "Updated chart colors", "Refreshed with new data"

  -- Full snapshot
  config JSONB NOT NULL,            -- DashboardConfig (HTML, charts, metadata)
  raw_content TEXT,                 -- Raw data content at this version
  data JSONB,                       -- Parsed data at this version
  data_source JSONB,                -- DataSource info at this version

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Indexes
  UNIQUE(dashboard_id, major_version, minor_version)
);

-- Add current version tracking to dashboards
ALTER TABLE dashboards
  ADD COLUMN current_major_version INTEGER DEFAULT 1,
  ADD COLUMN current_minor_version INTEGER DEFAULT 0;
```

---

## Implementation Tasks

### Phase 1: Database & Core Infrastructure

#### 1.1 Create Migration
- [ ] Create `011_dashboard_versions.sql`
- [ ] Add `dashboard_versions` table
- [ ] Add version columns to `dashboards`
- [ ] Add RLS policies

#### 1.2 TypeScript Types
- [ ] Add `DashboardVersion` interface to `types/database.ts`
- [ ] Update `Dashboard` type with version fields

#### 1.3 Version Service
- [ ] Create `src/lib/versions/index.ts`
- [ ] `createVersion(dashboardId, changeType, changeSummary)` - Creates new version snapshot
- [ ] `getVersions(dashboardId)` - Lists all versions
- [ ] `getVersion(dashboardId, major, minor)` - Gets specific version
- [ ] `restoreVersion(dashboardId, major, minor)` - Restores to a version (creates new version)
- [ ] `getNextVersion(dashboardId, type: 'major' | 'minor')` - Calculates next version number

---

### Phase 2: Update Existing Flows

#### 2.1 Dashboard Creation
- [ ] Update `POST /api/dashboards` to create initial version (1.0)
- [ ] Update `POST /api/dashboards/[id]/generate` to save version after generation completes

#### 2.2 Chat Modifications (Minor Versions)
- [ ] Update `POST /api/dashboards/[id]/chat` to:
  - Create new minor version after successful modification
  - Auto-generate change summary from AI response
  - Update dashboard's current version numbers

---

### Phase 3: Update Data Flow (Major Versions)

#### 3.1 API Endpoint
- [ ] Create `POST /api/dashboards/[id]/refresh`
  - Accepts new data (rawContent, data, dataSource)
  - For linked Google Sheets: triggers sync
  - Calls `refreshDashboardWithAgent`
  - Creates new major version (X.0)
  - Returns refresh summary with changes

#### 3.2 Google Sheets Sync Endpoint
- [ ] Update existing sync logic or create dedicated endpoint
- [ ] Support "delink and use new data" option

---

### Phase 4: Frontend UI

#### 4.1 Dashboard Header Actions
Location: `src/app/dashboards/[id]/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Q4 Sales Report                              [Publish ▼]│
│  v2.3 · Last edited 2 hours ago                             │
│                                                              │
│  [💬 Modify with AI]  [📄 Update Data]  [⏱ Version History]│
└─────────────────────────────────────────────────────────────┘
```

- [ ] Add version display (e.g., "v2.3")
- [ ] Rename "Edit with AI" to "Modify with AI"
- [ ] Add "Update Data" button
- [ ] Add "Version History" button/link

#### 4.2 Update Data Modal/Flow
- [ ] Create `UpdateDataModal` component
- [ ] Detect data source type and show appropriate UI:
  - **Paste**: Text area for new data
  - **Upload**: File upload dropzone
  - **Google Sheets (linked)**:
    - "Sync Now" button
    - "Use different data" option (delinks sheet)
- [ ] Show loading state during refresh
- [ ] Show success summary with changes detected

#### 4.3 Version History Panel
- [ ] Create `VersionHistoryPanel` component
- [ ] Display versions grouped by major version:
  ```
  ▼ Version 2 (Current)
      2.3 - Fixed chart title (2 hours ago)
      2.2 - Added trend line (yesterday)
      2.1 - Changed colors to brand blue (yesterday)
      2.0 - Updated with January 2024 data (2 days ago)

  ▶ Version 1 (3 versions)
  ```
- [ ] Preview version on hover/click
- [ ] "Restore this version" button
- [ ] Graceful handling of many versions (collapse old, show recent)

---

### Phase 5: Auto-Generate Change Summaries

#### 5.1 For AI Modifications
- [ ] Update chat prompts to request a one-line change summary
- [ ] Parse summary from AI response
- [ ] Fallback: "Modified dashboard via AI"

#### 5.2 For Data Refreshes
- [ ] Use `refreshDashboardWithAgent` response which already returns:
  - `summary`: Overall description
  - `changes`: Array of metric changes
- [ ] Format as version summary: "Updated with new data: Revenue increased 15%, users up 200"

---

## File Changes Summary

### New Files
```
supabase/migrations/011_dashboard_versions.sql
src/lib/versions/index.ts
src/app/api/dashboards/[id]/refresh/route.ts
src/app/api/dashboards/[id]/versions/route.ts
src/components/dashboard/UpdateDataModal.tsx
src/components/dashboard/VersionHistoryPanel.tsx
```

### Modified Files
```
src/types/database.ts                    - Add version types
src/app/api/dashboards/route.ts          - Create initial version
src/app/api/dashboards/[id]/generate/route.ts - Save version after generation
src/app/api/dashboards/[id]/chat/route.ts    - Create minor version after changes
src/app/dashboards/[id]/page.tsx         - Add UI for version display & actions
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboards/[id]/versions` | List all versions |
| GET | `/api/dashboards/[id]/versions/[major]/[minor]` | Get specific version |
| POST | `/api/dashboards/[id]/refresh` | Update data (creates major version) |
| POST | `/api/dashboards/[id]/versions/restore` | Restore to a version |

---

## UX Considerations

### Version Display
- Show current version prominently but not obtrusively
- Format: "v2.3" or "Version 2.3"

### History Panel
- Default: Show collapsed, expand on click
- Show last 5-10 versions expanded, older ones collapsed
- Group by major version for clarity
- Add search/filter for large histories (future)

### Update Data Flow
- Clear confirmation before refreshing
- Show what will happen: "This will update the dashboard with your new data"
- Progress indicator during refresh
- Success screen with summary of changes

### Google Sheets Linked
- Show last sync time
- "Sync Now" as primary action
- "Use different data instead" as secondary (with warning about delinking)

---

## Implementation Order

1. **Database migration** - Foundation
2. **Version service** - Core logic
3. **Update chat endpoint** - Minor versions working
4. **Refresh endpoint** - Major versions working
5. **Dashboard page UI** - Buttons and version display
6. **Update Data modal** - Data refresh UX
7. **Version History panel** - View and restore versions

---

## Estimated Scope

- **Database**: 1 migration file
- **Backend**: ~4 new/modified API routes, 1 service file
- **Frontend**: 2 new components, 1 modified page
- **Types**: Minor additions

## Questions Resolved

- ✅ Versioning: Major.Minor scheme
- ✅ Storage: Full snapshots
- ✅ Change summaries: Auto-generated
- ✅ Google Sheets: Confirmation flow with delink option
- ✅ Version limits: Defer pruning, handle UX gracefully
