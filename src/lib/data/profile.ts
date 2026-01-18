/**
 * Data Profiling Module
 *
 * Generates comprehensive data profiles that help the agent
 * understand the data quickly and make better visualization decisions.
 */

import type { ParsedData, DataSchema, ColumnInfo } from '@/types/dashboard';

// ============================================================================
// Types
// ============================================================================

export interface ColumnProfile {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'date';

  // Basic stats
  totalCount: number;
  nullCount: number;
  uniqueCount: number;

  // For numeric columns
  numericStats?: {
    min: number;
    max: number;
    mean: number;
    median: number;
    sum: number;
    stdDev: number;
  };

  // For categorical columns (string with limited unique values)
  categoricalStats?: {
    topValues: Array<{ value: string; count: number; percentage: number }>;
    isCategorical: boolean;
  };

  // For date columns
  dateStats?: {
    minDate: string;
    maxDate: string;
    dateRange: string;
  };

  // Visualization suggestions for this column
  suggestedRole: 'dimension' | 'measure' | 'time' | 'identifier';
}

export interface DataProfile {
  // Overview
  rowCount: number;
  columnCount: number;

  // Column details
  columns: ColumnProfile[];

  // Data quality
  qualityScore: number; // 0-100
  qualityIssues: string[];

  // Suggested visualizations based on data shape
  suggestedVisualizations: VisualizationSuggestion[];

  // Key insights the agent should know
  insights: string[];

  // Sample data for context
  sampleRows: Record<string, unknown>[];
}

export interface VisualizationSuggestion {
  type: 'bar' | 'line' | 'pie' | 'table' | 'metric-cards' | 'scatter' | 'area' | 'heatmap';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  columns: {
    x?: string;
    y?: string;
    category?: string;
    value?: string;
  };
}

// ============================================================================
// Profiling Functions
// ============================================================================

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculate median
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Profile a single column
 */
function profileColumn(
  name: string,
  values: unknown[],
  columnInfo: ColumnInfo
): ColumnProfile {
  const totalCount = values.length;
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  const nullCount = totalCount - nonNullValues.length;
  const uniqueValues = new Set(nonNullValues.map(String));
  const uniqueCount = uniqueValues.size;

  const profile: ColumnProfile = {
    name,
    type: columnInfo.type,
    totalCount,
    nullCount,
    uniqueCount,
    suggestedRole: 'dimension',
  };

  // Numeric column stats
  if (columnInfo.type === 'number') {
    const numericValues = nonNullValues
      .map(v => typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,%]/g, '')))
      .filter(v => !isNaN(v));

    if (numericValues.length > 0) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const mean = sum / numericValues.length;

      profile.numericStats = {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        mean,
        median: calculateMedian(numericValues),
        sum,
        stdDev: calculateStdDev(numericValues, mean),
      };

      profile.suggestedRole = 'measure';
    }
  }

  // Categorical detection for string columns
  if (columnInfo.type === 'string') {
    const isCategorical = uniqueCount <= 20 && uniqueCount < totalCount * 0.5;

    if (isCategorical || uniqueCount <= 50) {
      // Count occurrences
      const valueCounts = new Map<string, number>();
      for (const v of nonNullValues) {
        const str = String(v);
        valueCounts.set(str, (valueCounts.get(str) || 0) + 1);
      }

      // Sort by count and take top 10
      const topValues = Array.from(valueCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({
          value,
          count,
          percentage: Math.round((count / nonNullValues.length) * 100),
        }));

      profile.categoricalStats = {
        topValues,
        isCategorical,
      };
    }

    // Check if it looks like an identifier (high cardinality, unique)
    if (uniqueCount > totalCount * 0.9) {
      profile.suggestedRole = 'identifier';
    }
  }

  // Date column stats
  if (columnInfo.type === 'date') {
    const dates = nonNullValues
      .map(v => new Date(String(v)))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length > 0) {
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      const diffMs = maxDate.getTime() - minDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      let dateRange: string;
      if (diffDays < 31) {
        dateRange = `${diffDays} days`;
      } else if (diffDays < 365) {
        dateRange = `${Math.round(diffDays / 30)} months`;
      } else {
        dateRange = `${Math.round(diffDays / 365)} years`;
      }

      profile.dateStats = {
        minDate: minDate.toISOString().split('T')[0],
        maxDate: maxDate.toISOString().split('T')[0],
        dateRange,
      };

      profile.suggestedRole = 'time';
    }
  }

  return profile;
}

/**
 * Suggest visualizations based on data profile
 */
function suggestVisualizations(columns: ColumnProfile[]): VisualizationSuggestion[] {
  const suggestions: VisualizationSuggestion[] = [];

  const measures = columns.filter(c => c.suggestedRole === 'measure');
  const dimensions = columns.filter(c => c.suggestedRole === 'dimension');
  const timeColumns = columns.filter(c => c.suggestedRole === 'time');
  const categoricalDimensions = dimensions.filter(c => c.categoricalStats?.isCategorical);

  // Metric cards for key measures
  if (measures.length > 0 && measures.length <= 6) {
    suggestions.push({
      type: 'metric-cards',
      title: 'Key Metrics Overview',
      description: `Display ${measures.map(m => m.name).join(', ')} as metric cards with totals/averages`,
      confidence: 'high',
      columns: {
        value: measures[0].name,
      },
    });
  }

  // Time series if we have dates and measures
  if (timeColumns.length > 0 && measures.length > 0) {
    suggestions.push({
      type: 'line',
      title: `${measures[0].name} Over Time`,
      description: `Show how ${measures[0].name} changes over ${timeColumns[0].name}`,
      confidence: 'high',
      columns: {
        x: timeColumns[0].name,
        y: measures[0].name,
      },
    });

    // Area chart for cumulative view
    suggestions.push({
      type: 'area',
      title: `Cumulative ${measures[0].name}`,
      description: `Area chart showing cumulative ${measures[0].name} over time`,
      confidence: 'medium',
      columns: {
        x: timeColumns[0].name,
        y: measures[0].name,
      },
    });
  }

  // Bar chart for categorical breakdown
  if (categoricalDimensions.length > 0 && measures.length > 0) {
    const topCategorical = categoricalDimensions[0];
    suggestions.push({
      type: 'bar',
      title: `${measures[0].name} by ${topCategorical.name}`,
      description: `Compare ${measures[0].name} across different ${topCategorical.name} categories`,
      confidence: 'high',
      columns: {
        x: topCategorical.name,
        y: measures[0].name,
      },
    });

    // Pie chart if few categories
    if (topCategorical.uniqueCount <= 8) {
      suggestions.push({
        type: 'pie',
        title: `${measures[0].name} Distribution by ${topCategorical.name}`,
        description: `Pie chart showing proportion of ${measures[0].name} across ${topCategorical.name}`,
        confidence: 'medium',
        columns: {
          category: topCategorical.name,
          value: measures[0].name,
        },
      });
    }
  }

  // Scatter plot for two measures
  if (measures.length >= 2) {
    suggestions.push({
      type: 'scatter',
      title: `${measures[0].name} vs ${measures[1].name}`,
      description: `Explore correlation between ${measures[0].name} and ${measures[1].name}`,
      confidence: 'medium',
      columns: {
        x: measures[0].name,
        y: measures[1].name,
      },
    });
  }

  // Table for detailed view
  suggestions.push({
    type: 'table',
    title: 'Data Table',
    description: 'Sortable, filterable table showing all data',
    confidence: 'high',
    columns: {},
  });

  return suggestions;
}

/**
 * Generate insights about the data
 */
function generateInsights(columns: ColumnProfile[], rowCount: number): string[] {
  const insights: string[] = [];

  // Row count insight
  if (rowCount < 10) {
    insights.push(`Small dataset with only ${rowCount} rows - consider a simple table or card layout`);
  } else if (rowCount > 1000) {
    insights.push(`Large dataset with ${rowCount} rows - consider aggregations and summaries rather than showing all data`);
  }

  // Measure insights
  const measures = columns.filter(c => c.suggestedRole === 'measure');
  if (measures.length === 0) {
    insights.push('No clear numeric measures found - this might be categorical/descriptive data');
  } else if (measures.length > 5) {
    insights.push(`${measures.length} numeric measures found - consider focusing on the most important ones`);
  }

  // Time series insight
  const timeColumns = columns.filter(c => c.suggestedRole === 'time');
  if (timeColumns.length > 0) {
    const tc = timeColumns[0];
    if (tc.dateStats) {
      insights.push(`Time series data spanning ${tc.dateStats.dateRange} (${tc.dateStats.minDate} to ${tc.dateStats.maxDate})`);
    }
  }

  // Categorical insights
  const categoricals = columns.filter(c => c.categoricalStats?.isCategorical);
  for (const cat of categoricals.slice(0, 2)) {
    if (cat.categoricalStats && cat.categoricalStats.topValues.length > 0) {
      const topValue = cat.categoricalStats.topValues[0];
      insights.push(`${cat.name}: "${topValue.value}" is the most common value (${topValue.percentage}%)`);
    }
  }

  // Data quality insights
  const highNullColumns = columns.filter(c => c.nullCount > c.totalCount * 0.2);
  if (highNullColumns.length > 0) {
    insights.push(`Columns with >20% missing values: ${highNullColumns.map(c => c.name).join(', ')}`);
  }

  return insights;
}

/**
 * Calculate data quality score
 */
function calculateQualityScore(columns: ColumnProfile[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  for (const col of columns) {
    // Penalize high null rates
    const nullRate = col.nullCount / col.totalCount;
    if (nullRate > 0.5) {
      score -= 10;
      issues.push(`${col.name} has ${Math.round(nullRate * 100)}% missing values`);
    } else if (nullRate > 0.2) {
      score -= 5;
    }

    // Penalize single-value columns (no variance)
    if (col.uniqueCount === 1 && col.totalCount > 1) {
      score -= 5;
      issues.push(`${col.name} has only one unique value`);
    }
  }

  return { score: Math.max(0, score), issues };
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Generate a comprehensive data profile
 *
 * This profile gives the agent everything it needs to make
 * smart visualization decisions without re-analyzing the data.
 */
export function generateDataProfile(
  parsedData: ParsedData,
  schema: DataSchema
): DataProfile {
  const { rows, columns: columnNames } = parsedData;

  // Profile each column
  const columnProfiles = schema.columns.map(colInfo => {
    const values = rows.map(row => row[colInfo.name]);
    return profileColumn(colInfo.name, values, colInfo);
  });

  // Calculate quality score
  const { score: qualityScore, issues: qualityIssues } = calculateQualityScore(columnProfiles);

  // Generate suggestions and insights
  const suggestedVisualizations = suggestVisualizations(columnProfiles);
  const insights = generateInsights(columnProfiles, rows.length);

  return {
    rowCount: rows.length,
    columnCount: columnNames.length,
    columns: columnProfiles,
    qualityScore,
    qualityIssues,
    suggestedVisualizations,
    insights,
    sampleRows: rows.slice(0, 5),
  };
}

/**
 * Format profile as a concise string for the agent prompt
 */
export function formatProfileForAgent(profile: DataProfile): string {
  const lines: string[] = [];

  lines.push('=== DATA PROFILE ===');
  lines.push(`Rows: ${profile.rowCount} | Columns: ${profile.columnCount} | Quality: ${profile.qualityScore}/100`);
  lines.push('');

  // Column summary
  lines.push('COLUMNS:');
  for (const col of profile.columns) {
    let summary = `• ${col.name} (${col.type}, ${col.suggestedRole})`;

    if (col.numericStats) {
      const s = col.numericStats;
      summary += ` - range: ${s.min.toLocaleString()} to ${s.max.toLocaleString()}, avg: ${s.mean.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }

    if (col.categoricalStats?.isCategorical) {
      const topVals = col.categoricalStats.topValues.slice(0, 3).map(v => v.value).join(', ');
      summary += ` - categories: ${col.uniqueCount} (top: ${topVals})`;
    }

    if (col.dateStats) {
      summary += ` - ${col.dateStats.dateRange} (${col.dateStats.minDate} to ${col.dateStats.maxDate})`;
    }

    if (col.nullCount > 0) {
      summary += ` [${Math.round((col.nullCount / col.totalCount) * 100)}% null]`;
    }

    lines.push(summary);
  }

  // Insights
  if (profile.insights.length > 0) {
    lines.push('');
    lines.push('INSIGHTS:');
    for (const insight of profile.insights) {
      lines.push(`• ${insight}`);
    }
  }

  // Visualization suggestions
  if (profile.suggestedVisualizations.length > 0) {
    lines.push('');
    lines.push('SUGGESTED VISUALIZATIONS:');
    for (const viz of profile.suggestedVisualizations.filter(v => v.confidence === 'high').slice(0, 5)) {
      lines.push(`• ${viz.type.toUpperCase()}: ${viz.title} - ${viz.description}`);
    }
  }

  // Quality issues
  if (profile.qualityIssues.length > 0) {
    lines.push('');
    lines.push('DATA QUALITY NOTES:');
    for (const issue of profile.qualityIssues) {
      lines.push(`⚠ ${issue}`);
    }
  }

  return lines.join('\n');
}
