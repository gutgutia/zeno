/**
 * Client-safe content detection utilities
 * These functions can be used in browser components without importing the Anthropic SDK
 */

/**
 * Quick content type detection without full analysis
 * Useful for UI hints before full analysis runs
 */
export function detectContentTypeQuick(content: string): 'data' | 'text' | 'mixed' {
  const lines = content.trim().split('\n');
  if (lines.length === 0) return 'text';

  // Check for CSV/TSV patterns
  const firstLine = lines[0];
  const hasTabDelimiter = firstLine.includes('\t');
  const hasCommaDelimiter = firstLine.includes(',');

  if (hasTabDelimiter || hasCommaDelimiter) {
    // Check if subsequent lines have similar structure
    const delimiter = hasTabDelimiter ? '\t' : ',';
    const firstLineFields = firstLine.split(delimiter).length;

    let consistentLines = 0;
    for (let i = 1; i < Math.min(lines.length, 5); i++) {
      if (lines[i].split(delimiter).length === firstLineFields) {
        consistentLines++;
      }
    }

    if (consistentLines >= Math.min(lines.length - 1, 3)) {
      return 'data';
    }
  }

  // Check for JSON data
  if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
    try {
      JSON.parse(content);
      return 'data';
    } catch {
      // Not valid JSON, continue checking
    }
  }

  // Check for mostly prose (long lines, few delimiters)
  const avgLineLength = content.length / lines.length;
  const totalDelimiters = (content.match(/[,\t|]/g) || []).length;
  const delimiterRatio = totalDelimiters / content.length;

  if (avgLineLength > 100 && delimiterRatio < 0.02) {
    return 'text';
  }

  // If there's some structure but also prose, it's mixed
  if (lines.length > 5 && avgLineLength > 50) {
    return 'mixed';
  }

  return 'data';
}
