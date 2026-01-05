/**
 * Data Diff Utility
 *
 * Computes structured diffs between two versions of data.
 * Supports tabular data (CSV, TSV, JSON arrays), documents (text),
 * and structured data (JSON objects).
 *
 * Used by the refresh flow to determine what changed and enable
 * surgical updates to dashboards rather than full regeneration.
 */

import { parseCSV, detectDelimiter } from './parser';

// Content type detection
export type ContentType = 'tabular' | 'document' | 'structured' | 'unknown';

// Cell-level change for tabular data
export interface CellChange {
  row: number;
  column: string;
  oldValue: unknown;
  newValue: unknown;
}

// Schema change for tabular data
export interface SchemaChange {
  columnsAdded: string[];
  columnsRemoved: string[];
  columnsUnchanged: string[];
}

// Row change summary
export interface RowChanges {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

// Line change for document data
export interface LineChange {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  oldLine?: string;
  newLine?: string;
}

// Path change for structured data
export interface PathChange {
  path: string;
  type: 'added' | 'removed' | 'modified';
  oldValue?: unknown;
  newValue?: unknown;
}

// Main diff result interface
export interface DataDiff {
  contentType: ContentType;
  unchanged: boolean;

  // Domain change detection
  domainChanged: boolean;
  domainChangeReason?: string;

  // For tabular data
  schema?: SchemaChange;
  rows?: RowChanges;
  cells?: CellChange[];

  // For document data
  lines?: {
    added: number;
    removed: number;
    modified: number;
  };
  lineChanges?: LineChange[];

  // For structured data
  pathChanges?: PathChange[];

  // For AI consumption - always provided
  summary: string;
  affectedMetrics: string[];

  // Recommendation for the agent
  recommendedApproach: 'surgical' | 'regenerate';
}

/**
 * Detect the type of content
 */
export function detectContentType(content: string): ContentType {
  const trimmed = content.trim();

  // Try JSON first
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        // Array of objects = tabular
        if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
          return 'tabular';
        }
        return 'structured';
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return 'structured';
      }
    } catch {
      // Not valid JSON, continue checking
    }
  }

  // Check for tabular (CSV/TSV)
  const lines = trimmed.split('\n').filter(l => l.trim());
  if (lines.length >= 2) {
    const delimiters = [',', '\t', '|', ';'];
    for (const delim of delimiters) {
      const firstLineCols = lines[0].split(delim).length;
      if (firstLineCols > 1) {
        // Check if at least 80% of lines have similar column count
        const consistentLines = lines.filter(l => {
          const cols = l.split(delim).length;
          return cols === firstLineCols || Math.abs(cols - firstLineCols) <= 1;
        });
        if (consistentLines.length >= lines.length * 0.8) {
          return 'tabular';
        }
      }
    }
  }

  // Default to document
  return 'document';
}

/**
 * Parse content to rows based on detected type
 */
function parseToRows(content: string): { rows: Record<string, unknown>[]; columns: string[] } | null {
  const contentType = detectContentType(content);

  if (contentType === 'tabular') {
    // Try JSON array first
    const trimmed = content.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const columns = Object.keys(parsed[0]);
          return { rows: parsed, columns };
        }
      } catch {
        // Not JSON, try CSV
      }
    }

    // Parse as CSV/TSV
    const delimiter = detectDelimiter(content);
    const parsed = parseCSV(content, { delimiter });
    return { rows: parsed.rows, columns: parsed.columns };
  }

  return null;
}

/**
 * Compute diff for tabular data
 */
function computeTabularDiff(
  oldContent: string,
  newContent: string
): DataDiff {
  const oldParsed = parseToRows(oldContent);
  const newParsed = parseToRows(newContent);

  if (!oldParsed || !newParsed) {
    // Fallback to document diff if parsing fails
    return computeDocumentDiff(oldContent, newContent);
  }

  const { rows: oldRows, columns: oldColumns } = oldParsed;
  const { rows: newRows, columns: newColumns } = newParsed;

  // Schema comparison
  const columnsAdded = newColumns.filter(c => !oldColumns.includes(c));
  const columnsRemoved = oldColumns.filter(c => !newColumns.includes(c));
  const columnsUnchanged = newColumns.filter(c => oldColumns.includes(c));

  const schema: SchemaChange = {
    columnsAdded,
    columnsRemoved,
    columnsUnchanged,
  };

  // Check for domain change (completely different columns)
  const columnOverlap = columnsUnchanged.length / Math.max(oldColumns.length, newColumns.length);
  const domainChanged = columnOverlap < 0.3; // Less than 30% column overlap

  if (domainChanged) {
    return {
      contentType: 'tabular',
      unchanged: false,
      domainChanged: true,
      domainChangeReason: `Schema completely different: only ${columnsUnchanged.length} of ${Math.max(oldColumns.length, newColumns.length)} columns match`,
      schema,
      summary: `Data structure has fundamentally changed. Old columns: [${oldColumns.join(', ')}]. New columns: [${newColumns.join(', ')}]`,
      affectedMetrics: newColumns,
      recommendedApproach: 'regenerate',
    };
  }

  // Cell-by-cell comparison (for unchanged columns)
  const cells: CellChange[] = [];
  const maxRows = Math.max(oldRows.length, newRows.length);
  let modifiedRowCount = 0;

  for (let i = 0; i < maxRows; i++) {
    const oldRow = oldRows[i];
    const newRow = newRows[i];
    let rowModified = false;

    if (oldRow && newRow) {
      // Compare cells in shared columns
      for (const col of columnsUnchanged) {
        const oldVal = oldRow[col];
        const newVal = newRow[col];

        if (!valuesEqual(oldVal, newVal)) {
          cells.push({
            row: i,
            column: col,
            oldValue: oldVal,
            newValue: newVal,
          });
          rowModified = true;
        }
      }
    }

    if (rowModified) {
      modifiedRowCount++;
    }
  }

  const rowsAdded = Math.max(0, newRows.length - oldRows.length);
  const rowsRemoved = Math.max(0, oldRows.length - newRows.length);

  const rows: RowChanges = {
    added: rowsAdded,
    removed: rowsRemoved,
    modified: modifiedRowCount,
    unchanged: Math.min(oldRows.length, newRows.length) - modifiedRowCount,
  };

  // Check if unchanged
  const unchanged =
    columnsAdded.length === 0 &&
    columnsRemoved.length === 0 &&
    rowsAdded === 0 &&
    rowsRemoved === 0 &&
    cells.length === 0;

  // Build summary
  const summaryParts: string[] = [];
  if (columnsAdded.length > 0) {
    summaryParts.push(`Added columns: ${columnsAdded.join(', ')}`);
  }
  if (columnsRemoved.length > 0) {
    summaryParts.push(`Removed columns: ${columnsRemoved.join(', ')}`);
  }
  if (rowsAdded > 0) {
    summaryParts.push(`${rowsAdded} new rows added`);
  }
  if (rowsRemoved > 0) {
    summaryParts.push(`${rowsRemoved} rows removed`);
  }
  if (cells.length > 0) {
    summaryParts.push(`${cells.length} cell values changed across ${modifiedRowCount} rows`);
  }

  // Identify affected metrics (columns with changes)
  const affectedColumns = new Set<string>();
  for (const cell of cells) {
    affectedColumns.add(cell.column);
  }
  columnsAdded.forEach(c => affectedColumns.add(c));
  columnsRemoved.forEach(c => affectedColumns.add(c));

  return {
    contentType: 'tabular',
    unchanged,
    domainChanged: false,
    schema,
    rows,
    cells: cells.slice(0, 100), // Limit to first 100 cell changes
    summary: unchanged ? 'No changes detected' : summaryParts.join('. '),
    affectedMetrics: Array.from(affectedColumns),
    recommendedApproach: 'surgical',
  };
}

/**
 * Compute diff for document/text data
 */
function computeDocumentDiff(
  oldContent: string,
  newContent: string
): DataDiff {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Simple line-by-line diff
  const lineChanges: LineChange[] = [];
  const maxLines = Math.max(oldLines.length, newLines.length);

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined && newLine !== undefined) {
      // Line added
      lineChanges.push({
        type: 'added',
        lineNumber: i + 1,
        newLine,
      });
      addedCount++;
    } else if (oldLine !== undefined && newLine === undefined) {
      // Line removed
      lineChanges.push({
        type: 'removed',
        lineNumber: i + 1,
        oldLine,
      });
      removedCount++;
    } else if (oldLine !== newLine) {
      // Line modified
      lineChanges.push({
        type: 'modified',
        lineNumber: i + 1,
        oldLine,
        newLine,
      });
      modifiedCount++;
    }
  }

  const unchanged = lineChanges.length === 0;

  // Check for domain change in documents
  // If more than 70% of lines are completely different, it might be different content
  const totalChangedLines = addedCount + removedCount + modifiedCount;
  const domainChanged = !unchanged && totalChangedLines > maxLines * 0.7;

  const summaryParts: string[] = [];
  if (addedCount > 0) summaryParts.push(`${addedCount} lines added`);
  if (removedCount > 0) summaryParts.push(`${removedCount} lines removed`);
  if (modifiedCount > 0) summaryParts.push(`${modifiedCount} lines modified`);

  return {
    contentType: 'document',
    unchanged,
    domainChanged,
    domainChangeReason: domainChanged ? 'Document content substantially different (>70% changed)' : undefined,
    lines: {
      added: addedCount,
      removed: removedCount,
      modified: modifiedCount,
    },
    lineChanges: lineChanges.slice(0, 50), // Limit changes
    summary: unchanged ? 'No changes detected' : summaryParts.join(', '),
    affectedMetrics: [], // Documents don't have metrics
    recommendedApproach: domainChanged ? 'regenerate' : 'surgical',
  };
}

/**
 * Compute diff for structured (JSON object) data
 */
function computeStructuredDiff(
  oldContent: string,
  newContent: string
): DataDiff {
  let oldObj: Record<string, unknown>;
  let newObj: Record<string, unknown>;

  try {
    oldObj = JSON.parse(oldContent);
    newObj = JSON.parse(newContent);
  } catch {
    // Fallback to document diff
    return computeDocumentDiff(oldContent, newContent);
  }

  const pathChanges: PathChange[] = [];

  // Deep comparison
  function compareObjects(
    oldVal: unknown,
    newVal: unknown,
    path: string
  ): void {
    if (oldVal === newVal) return;

    if (oldVal === undefined && newVal !== undefined) {
      pathChanges.push({ path, type: 'added', newValue: newVal });
      return;
    }

    if (oldVal !== undefined && newVal === undefined) {
      pathChanges.push({ path, type: 'removed', oldValue: oldVal });
      return;
    }

    if (typeof oldVal !== typeof newVal) {
      pathChanges.push({ path, type: 'modified', oldValue: oldVal, newValue: newVal });
      return;
    }

    if (typeof oldVal === 'object' && oldVal !== null && newVal !== null) {
      const oldKeys = Object.keys(oldVal as Record<string, unknown>);
      const newKeys = Object.keys(newVal as Record<string, unknown>);
      const allKeys = new Set([...oldKeys, ...newKeys]);

      for (const key of allKeys) {
        compareObjects(
          (oldVal as Record<string, unknown>)[key],
          (newVal as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key
        );
      }
    } else if (!valuesEqual(oldVal, newVal)) {
      pathChanges.push({ path, type: 'modified', oldValue: oldVal, newValue: newVal });
    }
  }

  compareObjects(oldObj, newObj, '');

  const unchanged = pathChanges.length === 0;

  // Check domain change based on root keys
  const oldKeys = Object.keys(oldObj);
  const newKeys = Object.keys(newObj);
  const commonKeys = oldKeys.filter(k => newKeys.includes(k));
  const keyOverlap = commonKeys.length / Math.max(oldKeys.length, newKeys.length);
  const domainChanged = keyOverlap < 0.3;

  const addedPaths = pathChanges.filter(c => c.type === 'added').length;
  const removedPaths = pathChanges.filter(c => c.type === 'removed').length;
  const modifiedPaths = pathChanges.filter(c => c.type === 'modified').length;

  const summaryParts: string[] = [];
  if (addedPaths > 0) summaryParts.push(`${addedPaths} fields added`);
  if (removedPaths > 0) summaryParts.push(`${removedPaths} fields removed`);
  if (modifiedPaths > 0) summaryParts.push(`${modifiedPaths} fields modified`);

  return {
    contentType: 'structured',
    unchanged,
    domainChanged,
    domainChangeReason: domainChanged ? 'Object structure substantially different' : undefined,
    pathChanges: pathChanges.slice(0, 50),
    summary: unchanged ? 'No changes detected' : summaryParts.join(', '),
    affectedMetrics: pathChanges.map(c => c.path),
    recommendedApproach: domainChanged ? 'regenerate' : 'surgical',
  };
}

/**
 * Check if two values are equal
 */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;

  // Handle numeric comparison with tolerance for floating point
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) < 0.0001) return true;
  }

  // String comparison (normalized)
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim() === b.trim();
  }

  // For objects/arrays, do JSON comparison
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}

/**
 * Main entry point: compute diff between old and new content
 */
export function computeDataDiff(
  oldContent: string,
  newContent: string
): DataDiff {
  // Quick check for identical content
  if (oldContent === newContent) {
    return {
      contentType: detectContentType(newContent),
      unchanged: true,
      domainChanged: false,
      summary: 'No changes detected',
      affectedMetrics: [],
      recommendedApproach: 'surgical',
    };
  }

  // Detect content type based on new content
  const contentType = detectContentType(newContent);

  switch (contentType) {
    case 'tabular':
      return computeTabularDiff(oldContent, newContent);
    case 'structured':
      return computeStructuredDiff(oldContent, newContent);
    case 'document':
    case 'unknown':
    default:
      return computeDocumentDiff(oldContent, newContent);
  }
}

/**
 * Format diff for AI consumption - creates a concise prompt-friendly summary
 */
export function formatDiffForAI(diff: DataDiff): string {
  if (diff.unchanged) {
    return 'NO CHANGES DETECTED - No updates needed.';
  }

  const parts: string[] = [];

  parts.push(`CONTENT TYPE: ${diff.contentType}`);
  parts.push(`SUMMARY: ${diff.summary}`);

  if (diff.domainChanged) {
    parts.push(`⚠️ DOMAIN CHANGE DETECTED: ${diff.domainChangeReason}`);
    parts.push('RECOMMENDATION: Full regeneration may be needed');
    return parts.join('\n');
  }

  if (diff.contentType === 'tabular' && diff.schema) {
    if (diff.schema.columnsAdded.length > 0) {
      parts.push(`NEW COLUMNS: ${diff.schema.columnsAdded.join(', ')}`);
    }
    if (diff.schema.columnsRemoved.length > 0) {
      parts.push(`REMOVED COLUMNS: ${diff.schema.columnsRemoved.join(', ')}`);
    }

    if (diff.rows) {
      if (diff.rows.added > 0) parts.push(`NEW ROWS: ${diff.rows.added} rows added at end`);
      if (diff.rows.removed > 0) parts.push(`REMOVED ROWS: ${diff.rows.removed} rows removed`);
    }

    if (diff.cells && diff.cells.length > 0) {
      parts.push('\nCELL VALUE CHANGES:');
      // Group by column for cleaner output
      const byColumn = new Map<string, CellChange[]>();
      for (const cell of diff.cells) {
        if (!byColumn.has(cell.column)) {
          byColumn.set(cell.column, []);
        }
        byColumn.get(cell.column)!.push(cell);
      }

      for (const [column, changes] of byColumn) {
        if (changes.length <= 3) {
          // Show individual changes
          for (const c of changes) {
            parts.push(`  - ${column} (row ${c.row + 1}): "${c.oldValue}" → "${c.newValue}"`);
          }
        } else {
          // Summarize
          parts.push(`  - ${column}: ${changes.length} values changed`);
          // Show first 2 examples
          for (const c of changes.slice(0, 2)) {
            parts.push(`    e.g. row ${c.row + 1}: "${c.oldValue}" → "${c.newValue}"`);
          }
        }
      }
    }
  }

  if (diff.contentType === 'document' && diff.lineChanges) {
    parts.push('\nLINE CHANGES (first 10):');
    for (const change of diff.lineChanges.slice(0, 10)) {
      if (change.type === 'added') {
        parts.push(`  + Line ${change.lineNumber}: "${change.newLine?.slice(0, 50)}..."`);
      } else if (change.type === 'removed') {
        parts.push(`  - Line ${change.lineNumber}: "${change.oldLine?.slice(0, 50)}..."`);
      } else {
        parts.push(`  ~ Line ${change.lineNumber}: "${change.oldLine?.slice(0, 30)}..." → "${change.newLine?.slice(0, 30)}..."`);
      }
    }
  }

  if (diff.contentType === 'structured' && diff.pathChanges) {
    parts.push('\nFIELD CHANGES:');
    for (const change of diff.pathChanges.slice(0, 15)) {
      if (change.type === 'added') {
        parts.push(`  + ${change.path}: ${JSON.stringify(change.newValue)}`);
      } else if (change.type === 'removed') {
        parts.push(`  - ${change.path}`);
      } else {
        parts.push(`  ~ ${change.path}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`);
      }
    }
  }

  if (diff.affectedMetrics.length > 0) {
    parts.push(`\nAFFECTED METRICS/COLUMNS: ${diff.affectedMetrics.slice(0, 20).join(', ')}`);
  }

  parts.push(`\nRECOMMENDED APPROACH: ${diff.recommendedApproach.toUpperCase()}`);

  return parts.join('\n');
}

/**
 * Export the diff as a condensed object for logging/storage
 */
export function condenseDiff(diff: DataDiff): Record<string, unknown> {
  return {
    contentType: diff.contentType,
    unchanged: diff.unchanged,
    domainChanged: diff.domainChanged,
    recommendedApproach: diff.recommendedApproach,
    summary: diff.summary,
    stats: {
      ...(diff.schema && {
        columnsAdded: diff.schema.columnsAdded.length,
        columnsRemoved: diff.schema.columnsRemoved.length,
      }),
      ...(diff.rows && {
        rowsAdded: diff.rows.added,
        rowsRemoved: diff.rows.removed,
        rowsModified: diff.rows.modified,
      }),
      ...(diff.cells && { cellsChanged: diff.cells.length }),
      ...(diff.lines && {
        linesAdded: diff.lines.added,
        linesRemoved: diff.lines.removed,
        linesModified: diff.lines.modified,
      }),
      ...(diff.pathChanges && { pathsChanged: diff.pathChanges.length }),
    },
    affectedMetrics: diff.affectedMetrics,
  };
}
