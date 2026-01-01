# Zeno AI Integration

## Overview

Zeno uses Claude (Anthropic) for:
1. **Initial Generation** — Analyze data and create a dashboard config
2. **Chat Iteration** — Modify dashboards via natural language

**Key Insight:** Claude generates a **JSON configuration**, not code. Our React app renders the config using Recharts. This approach is:
- ✅ Secure (no code execution)
- ✅ Fast (instant rendering)
- ✅ Reliable (predictable output)
- ✅ Editable (users can manually tweak)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│   │ Paste/Upload │─────▶│ Parse Data   │─────▶│ Data Schema  │  │
│   │    CSV       │      │ (Papa Parse) │      │ + Full Data  │  │
│   └──────────────┘      └──────────────┘      └──────┬───────┘  │
│                                                       │         │
│                                            ┌──────────┴───────┐ │
│                                            ▼                  │ │
│   ┌──────────────┐      ┌──────────────┐  Schema only         │ │
│   │   Render     │◀─────│  Dashboard   │◀─────────────────┐   │ │
│   │  (Recharts)  │      │    Config    │                  │   │ │
│   └──────────────┘      └──────────────┘                  │   │ │
│          ▲                     │                          │   │ │
│          │                     │                          │   │ │
│          │              ┌──────▼──────┐           ┌───────┴───┐ │
│          │              │  User Chat  │──────────▶│  Claude   │ │
│          │              │  "Make it   │           │   API     │ │
│          └──────────────│   a bar..." │◀──────────│ (Server)  │ │
│                         └─────────────┘           └───────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Step 1: Parse Data (Client-Side)

When user pastes or uploads data:

```typescript
// lib/data/parser.ts
import Papa from 'papaparse';

export function parseCSV(rawText: string): ParsedData {
  const result = Papa.parse(rawText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  
  return {
    rows: result.data,
    columns: result.meta.fields,
    errors: result.errors,
  };
}
```

### Step 2: Analyze Schema (Client-Side)

Extract metadata about the data:

```typescript
// lib/data/analyzer.ts

export interface DataSchema {
  columns: ColumnInfo[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
}

export interface ColumnInfo {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  uniqueValues?: (string | number)[];  // For low-cardinality columns
  min?: number;
  max?: number;
  avg?: number;
  nullCount: number;
  sampleValues: (string | number | null)[];
}

export function analyzeData(rows: Record<string, unknown>[]): DataSchema {
  const columns = Object.keys(rows[0] || {}).map(name => {
    const values = rows.map(row => row[name]);
    const nonNull = values.filter(v => v != null);
    
    // Detect type
    const type = detectType(nonNull);
    
    // Compute stats
    const stats = computeStats(nonNull, type);
    
    return {
      name,
      type,
      ...stats,
      nullCount: values.length - nonNull.length,
      sampleValues: nonNull.slice(0, 5),
    };
  });
  
  return {
    columns,
    rowCount: rows.length,
    sampleRows: rows.slice(0, 5),
  };
}

function detectType(values: unknown[]): ColumnInfo['type'] {
  const sample = values.slice(0, 100);
  
  // Check if all are numbers
  if (sample.every(v => typeof v === 'number')) return 'number';
  
  // Check if all are dates
  if (sample.every(v => !isNaN(Date.parse(String(v))))) return 'date';
  
  // Check if all are booleans
  if (sample.every(v => typeof v === 'boolean')) return 'boolean';
  
  return 'string';
}

function computeStats(values: unknown[], type: string) {
  if (type === 'number') {
    const nums = values as number[];
    return {
      min: Math.min(...nums),
      max: Math.max(...nums),
      avg: nums.reduce((a, b) => a + b, 0) / nums.length,
    };
  }
  
  if (type === 'string') {
    const unique = [...new Set(values as string[])];
    // Only include if low cardinality (useful for grouping)
    if (unique.length <= 20) {
      return { uniqueValues: unique };
    }
  }
  
  return {};
}
```

### Step 3: Send to Claude (Server-Side)

Only the **schema** goes to Claude, not the full data:

```typescript
// app/api/ai/generate/route.ts

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const { schema, title } = await request.json();
  
  const systemPrompt = getSystemPrompt();
  const userPrompt = getGenerationPrompt(schema, title);
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ],
  });
  
  // Extract JSON from response
  const config = parseConfigFromResponse(response.content[0].text);
  
  return Response.json({ config });
}
```

### Step 4: Render Dashboard (Client-Side)

The config drives the chart rendering:

```typescript
// components/dashboard/dashboard-grid.tsx

import { ChartRenderer } from '../charts/chart-renderer';

interface DashboardGridProps {
  config: DashboardConfig;
  data: Record<string, unknown>[];
}

export function DashboardGrid({ config, data }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {config.charts.map(chart => (
        <ChartRenderer 
          key={chart.id} 
          chart={chart} 
          data={data} 
        />
      ))}
    </div>
  );
}
```

---

## System Prompt

```typescript
// lib/ai/prompts.ts

export const SYSTEM_PROMPT = `You are a dashboard designer AI for Zeno, a platform that creates beautiful dashboards from data.

Your job is to analyze data schemas and generate dashboard configurations that visualize the data effectively.

## Your Capabilities

You output JSON configurations that our React application renders. You do NOT write code.

## Available Chart Types

1. **number_card** - Single metric display (KPI)
   - Best for: totals, averages, key metrics
   - Config: { column, aggregation, format, comparison? }

2. **line** - Line chart for trends
   - Best for: time series, trends over time
   - Config: { xAxis, yAxis, splitBy?, color? }

3. **bar** - Bar chart for comparisons
   - Best for: categorical comparisons, rankings
   - Config: { xAxis, yAxis, orientation?, color? }

4. **area** - Area chart for cumulative trends
   - Best for: showing volume over time
   - Config: { xAxis, yAxis, stacked?, color? }

5. **pie** - Pie/donut chart for proportions
   - Best for: part-to-whole relationships (< 7 categories)
   - Config: { groupBy, value, donut? }

6. **table** - Data table
   - Best for: detailed data, many columns
   - Config: { columns, sortBy?, pageSize? }

## Aggregation Functions

- sum: Total of all values
- avg: Average value
- min: Minimum value
- max: Maximum value
- count: Number of rows
- countDistinct: Number of unique values

## Formatting Options

- number: Plain number (1234)
- currency: Dollar format ($1,234)
- percent: Percentage (12.34%)
- compact: Shortened (1.2K, 1.2M)

## Design Guidelines

1. Start with 2-4 number cards for key metrics
2. Use line charts for time-based data
3. Use bar charts for categorical comparisons
4. Limit pie charts to < 7 categories
5. Choose colors that work well together
6. Use clear, descriptive titles
7. Group related metrics together

## Output Format

Always respond with valid JSON in this exact structure:

{
  "title": "Dashboard Title",
  "description": "Brief description",
  "charts": [
    {
      "id": "unique-id",
      "type": "chart_type",
      "title": "Chart Title",
      "config": { /* type-specific config */ }
    }
  ]
}`;
```

---

## Generation Prompt

```typescript
// lib/ai/prompts.ts

export function getGenerationPrompt(schema: DataSchema, title?: string): string {
  return `Create a dashboard for the following data.

${title ? `Dashboard Title: ${title}` : 'Choose an appropriate title based on the data.'}

## Data Schema

Columns:
${schema.columns.map(col => `- ${col.name} (${col.type})${col.uniqueValues ? ` - unique values: ${col.uniqueValues.join(', ')}` : ''}${col.min !== undefined ? ` - range: ${col.min} to ${col.max}` : ''}`).join('\n')}

Row count: ${schema.rowCount}

Sample data:
${JSON.stringify(schema.sampleRows, null, 2)}

## Instructions

1. Analyze the data to understand what it represents
2. Identify the key metrics and dimensions
3. Create a dashboard with appropriate visualizations
4. Include number cards for important totals/averages
5. Use charts that best represent the data relationships

Respond with ONLY the JSON configuration, no explanation.`;
}
```

---

## Iteration Prompt

```typescript
// lib/ai/prompts.ts

export function getIterationPrompt(
  currentConfig: DashboardConfig,
  schema: DataSchema,
  userMessage: string
): string {
  return `You are modifying an existing dashboard based on user feedback.

## Current Dashboard Configuration

${JSON.stringify(currentConfig, null, 2)}

## Available Data

Columns:
${schema.columns.map(col => `- ${col.name} (${col.type})`).join('\n')}

## User Request

"${userMessage}"

## Instructions

1. Understand what the user wants to change
2. Modify the configuration accordingly
3. Keep unchanged elements the same
4. Return the COMPLETE updated configuration

Respond with ONLY the updated JSON configuration, no explanation.`;
}
```

---

## Chart Configuration Schema

### Number Card

```typescript
interface NumberCardConfig {
  column: string;           // Which column to aggregate
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'latest';
  format?: 'number' | 'currency' | 'percent' | 'compact';
  prefix?: string;          // e.g., "$"
  suffix?: string;          // e.g., "%"
  comparison?: {
    type: 'previous' | 'target';
    value?: number;         // For target comparison
    column?: string;        // For previous period
  };
}

// Example
{
  "id": "total-revenue",
  "type": "number_card",
  "title": "Total Revenue",
  "config": {
    "column": "Revenue",
    "aggregation": "sum",
    "format": "currency"
  }
}
```

### Line Chart

```typescript
interface LineChartConfig {
  xAxis: {
    column: string;
    type?: 'category' | 'time';
    format?: string;        // Date format if time
  };
  yAxis: {
    column: string;
    aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
    format?: 'number' | 'currency' | 'percent' | 'compact';
  };
  splitBy?: string;         // Create multiple lines
  colors?: string[];
  showDots?: boolean;
  showGrid?: boolean;
  smooth?: boolean;         // Curved lines
}

// Example
{
  "id": "revenue-trend",
  "type": "line",
  "title": "Revenue Over Time",
  "config": {
    "xAxis": { "column": "Month", "type": "category" },
    "yAxis": { "column": "Revenue", "aggregation": "sum", "format": "currency" },
    "splitBy": "Region",
    "colors": ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
    "showDots": true,
    "smooth": true
  }
}
```

### Bar Chart

```typescript
interface BarChartConfig {
  xAxis: {
    column: string;
  };
  yAxis: {
    column: string;
    aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
    format?: 'number' | 'currency' | 'percent' | 'compact';
  };
  orientation?: 'vertical' | 'horizontal';
  splitBy?: string;         // Grouped bars
  stacked?: boolean;        // Stacked bars
  colors?: string[];
  sortBy?: 'label' | 'value';
  sortOrder?: 'asc' | 'desc';
  limit?: number;           // Top N
}

// Example
{
  "id": "sales-by-region",
  "type": "bar",
  "title": "Sales by Region",
  "config": {
    "xAxis": { "column": "Region" },
    "yAxis": { "column": "Sales", "aggregation": "sum", "format": "currency" },
    "orientation": "horizontal",
    "sortBy": "value",
    "sortOrder": "desc",
    "colors": ["#3B82F6"]
  }
}
```

### Pie Chart

```typescript
interface PieChartConfig {
  groupBy: string;          // Categories
  value: {
    column: string;
    aggregation?: 'sum' | 'avg' | 'count';
  };
  donut?: boolean;          // Donut vs pie
  showLabels?: boolean;
  showPercent?: boolean;
  colors?: string[];
  limit?: number;           // Top N, rest grouped as "Other"
}

// Example
{
  "id": "revenue-by-product",
  "type": "pie",
  "title": "Revenue by Product",
  "config": {
    "groupBy": "Product",
    "value": { "column": "Revenue", "aggregation": "sum" },
    "donut": true,
    "showLabels": true,
    "showPercent": true,
    "limit": 5
  }
}
```

### Data Table

```typescript
interface TableConfig {
  columns: {
    column: string;
    label?: string;
    format?: 'number' | 'currency' | 'percent' | 'date';
    width?: number;
  }[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  showPagination?: boolean;
}

// Example
{
  "id": "data-table",
  "type": "table",
  "title": "Detailed Data",
  "config": {
    "columns": [
      { "column": "Date", "label": "Date", "format": "date" },
      { "column": "Product", "label": "Product" },
      { "column": "Revenue", "label": "Revenue", "format": "currency" },
      { "column": "Units", "label": "Units Sold", "format": "number" }
    ],
    "sortBy": "Date",
    "sortOrder": "desc",
    "pageSize": 10
  }
}
```

---

## Data Aggregation

Charts render aggregated data, not raw rows:

```typescript
// lib/data/aggregator.ts

export function aggregateForChart(
  data: Record<string, unknown>[],
  chartConfig: ChartConfig
): Record<string, unknown>[] {
  switch (chartConfig.type) {
    case 'number_card':
      return aggregateNumberCard(data, chartConfig.config);
    case 'line':
    case 'bar':
    case 'area':
      return aggregateXY(data, chartConfig.config);
    case 'pie':
      return aggregatePie(data, chartConfig.config);
    case 'table':
      return data; // Tables show raw data
  }
}

function aggregateXY(
  data: Record<string, unknown>[],
  config: LineChartConfig | BarChartConfig
): Record<string, unknown>[] {
  const { xAxis, yAxis, splitBy } = config;
  
  // Group by x-axis value (and splitBy if present)
  const groups = new Map<string, Record<string, number[]>>();
  
  for (const row of data) {
    const xValue = String(row[xAxis.column]);
    const yValue = Number(row[yAxis.column]) || 0;
    const splitValue = splitBy ? String(row[splitBy]) : '_total';
    
    if (!groups.has(xValue)) {
      groups.set(xValue, {});
    }
    const group = groups.get(xValue)!;
    if (!group[splitValue]) {
      group[splitValue] = [];
    }
    group[splitValue].push(yValue);
  }
  
  // Apply aggregation
  const result: Record<string, unknown>[] = [];
  
  for (const [xValue, splits] of groups) {
    const row: Record<string, unknown> = { [xAxis.column]: xValue };
    
    for (const [splitValue, values] of Object.entries(splits)) {
      const aggregated = applyAggregation(values, yAxis.aggregation || 'sum');
      const key = splitBy ? splitValue : yAxis.column;
      row[key] = aggregated;
    }
    
    result.push(row);
  }
  
  return result;
}

function applyAggregation(values: number[], fn: string): number {
  switch (fn) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'count': return values.length;
    default: return values.reduce((a, b) => a + b, 0);
  }
}
```

---

## Error Handling

```typescript
// lib/ai/claude.ts

export async function generateDashboard(
  schema: DataSchema,
  title?: string
): Promise<DashboardConfig> {
  try {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema, title }),
    });
    
    if (!response.ok) {
      throw new Error(`AI request failed: ${response.statusText}`);
    }
    
    const { config } = await response.json();
    
    // Validate the config
    const validated = validateDashboardConfig(config);
    
    return validated;
  } catch (error) {
    console.error('Dashboard generation failed:', error);
    
    // Return a fallback config
    return getFallbackConfig(schema);
  }
}

function getFallbackConfig(schema: DataSchema): DashboardConfig {
  // Create a basic dashboard if AI fails
  const charts: ChartConfig[] = [];
  
  // Add number cards for numeric columns
  const numericColumns = schema.columns.filter(c => c.type === 'number');
  for (const col of numericColumns.slice(0, 4)) {
    charts.push({
      id: `card-${col.name}`,
      type: 'number_card',
      title: `Total ${col.name}`,
      config: {
        column: col.name,
        aggregation: 'sum',
        format: 'number',
      },
    });
  }
  
  // Add a table with all data
  charts.push({
    id: 'data-table',
    type: 'table',
    title: 'Data',
    config: {
      columns: schema.columns.map(c => ({
        column: c.name,
        label: c.name,
      })),
    },
  });
  
  return {
    title: 'Dashboard',
    charts,
  };
}
```

---

## Rate Limiting & Cost Control

```typescript
// app/api/ai/generate/route.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

export async function POST(request: Request) {
  // Get user ID from session
  const userId = await getUserId(request);
  
  // Check rate limit
  const { success, remaining } = await ratelimit.limit(userId);
  
  if (!success) {
    return Response.json(
      { error: 'Rate limit exceeded. Please wait a moment.' },
      { status: 429 }
    );
  }
  
  // ... rest of generation logic
}
```

---

## Why This Approach Works

### No Agent/Tools Needed

| Scenario | How We Handle It |
|----------|------------------|
| Reading files | Client-side parsing (Papa Parse, SheetJS) |
| Data transformations | JavaScript aggregation functions |
| Chart rendering | React + Recharts |
| Code execution | Not needed — JSON config only |

### Security

- No arbitrary code execution
- Claude only sees schema, not full data
- Config is validated before rendering
- Rate limiting prevents abuse

### Performance

- Data stays in browser (no round-trip for rendering)
- Only schema sent to Claude (small payload)
- Instant re-rendering on config changes
- Charts computed client-side

### Flexibility

- Rich config schema supports many use cases
- Easy to add new chart types
- Users can manually edit config
- AI can make sophisticated design decisions

