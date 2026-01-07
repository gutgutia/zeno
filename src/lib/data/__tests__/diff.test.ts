/**
 * Data Diff Unit Tests
 *
 * Tests for diff computation between data versions.
 */

import { describe, it, expect } from 'vitest';
import {
  detectContentType,
  computeDataDiff,
  formatDiffForAI,
} from '../diff';

describe('detectContentType', () => {
  describe('tabular content', () => {
    it('should detect CSV as tabular', () => {
      const content = `name,age,city
Alice,30,NYC
Bob,25,LA`;

      expect(detectContentType(content)).toBe('tabular');
    });

    it('should detect TSV as tabular', () => {
      const content = `name\tage\tcity
Alice\t30\tNYC
Bob\t25\tLA`;

      expect(detectContentType(content)).toBe('tabular');
    });

    it('should detect JSON array of objects as tabular', () => {
      const content = JSON.stringify([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]);

      expect(detectContentType(content)).toBe('tabular');
    });
  });

  describe('structured content', () => {
    it('should detect JSON object as structured', () => {
      const content = JSON.stringify({
        name: 'Dashboard',
        settings: { theme: 'dark' },
      });

      expect(detectContentType(content)).toBe('structured');
    });

    it('should detect simple JSON array as structured', () => {
      const content = JSON.stringify([1, 2, 3, 4, 5]);

      expect(detectContentType(content)).toBe('structured');
    });
  });

  describe('document content', () => {
    it('should detect plain text as document', () => {
      const content = `This is a plain text document.
It has multiple lines.
But no clear structure.`;

      expect(detectContentType(content)).toBe('document');
    });

    it('should detect markdown as document', () => {
      const content = `# Heading

This is some markdown content.

- Item 1
- Item 2`;

      expect(detectContentType(content)).toBe('document');
    });
  });
});

describe('computeDataDiff', () => {
  describe('identical content', () => {
    it('should detect no changes for identical content', () => {
      const content = `name,value
Alice,100
Bob,200`;

      const diff = computeDataDiff(content, content);

      expect(diff.unchanged).toBe(true);
      expect(diff.summary).toBe('No changes detected');
      expect(diff.recommendedApproach).toBe('surgical');
    });
  });

  describe('tabular data changes', () => {
    it('should detect added columns', () => {
      const oldContent = `name,value
Alice,100`;
      const newContent = `name,value,status
Alice,100,active`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.contentType).toBe('tabular');
      expect(diff.unchanged).toBe(false);
      expect(diff.schema?.columnsAdded).toContain('status');
      expect(diff.recommendedApproach).toBe('surgical');
    });

    it('should detect removed columns', () => {
      const oldContent = `name,value,status
Alice,100,active`;
      const newContent = `name,value
Alice,100`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.schema?.columnsRemoved).toContain('status');
    });

    it('should detect cell value changes', () => {
      const oldContent = `name,value
Alice,100
Bob,200`;
      const newContent = `name,value
Alice,150
Bob,200`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.cells).toBeDefined();
      expect(diff.cells?.length).toBeGreaterThan(0);

      const valueChange = diff.cells?.find(c => c.column === 'value' && c.row === 0);
      expect(valueChange?.oldValue).toBe(100);
      expect(valueChange?.newValue).toBe(150);
    });

    it('should detect added rows', () => {
      const oldContent = `name,value
Alice,100`;
      const newContent = `name,value
Alice,100
Bob,200`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.rows?.added).toBe(1);
    });

    it('should detect removed rows', () => {
      const oldContent = `name,value
Alice,100
Bob,200`;
      const newContent = `name,value
Alice,100`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.rows?.removed).toBe(1);
    });

    it('should detect domain change when schema is completely different', () => {
      const oldContent = `name,age,city
Alice,30,NYC`;
      const newContent = `product_id,price,quantity
SKU001,29.99,100`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.domainChanged).toBe(true);
      expect(diff.recommendedApproach).toBe('regenerate');
    });
  });

  describe('document changes', () => {
    it('should detect line additions', () => {
      const oldContent = `Line 1
Line 2`;
      const newContent = `Line 1
Line 2
Line 3`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.contentType).toBe('document');
      expect(diff.lines?.added).toBe(1);
    });

    it('should detect line removals', () => {
      const oldContent = `Line 1
Line 2
Line 3`;
      const newContent = `Line 1
Line 2`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.lines?.removed).toBe(1);
    });

    it('should detect line modifications', () => {
      const oldContent = `Line 1
Original line 2
Line 3`;
      const newContent = `Line 1
Modified line 2
Line 3`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.lines?.modified).toBe(1);
    });
  });

  describe('structured data changes', () => {
    it('should detect added fields', () => {
      const oldContent = JSON.stringify({ name: 'Alice' });
      const newContent = JSON.stringify({ name: 'Alice', age: 30 });

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.contentType).toBe('structured');
      const addedPath = diff.pathChanges?.find(c => c.path === 'age' && c.type === 'added');
      expect(addedPath).toBeDefined();
    });

    it('should detect removed fields', () => {
      const oldContent = JSON.stringify({ name: 'Alice', age: 30 });
      const newContent = JSON.stringify({ name: 'Alice' });

      const diff = computeDataDiff(oldContent, newContent);

      const removedPath = diff.pathChanges?.find(c => c.path === 'age' && c.type === 'removed');
      expect(removedPath).toBeDefined();
    });

    it('should detect modified fields', () => {
      const oldContent = JSON.stringify({ name: 'Alice', age: 30 });
      const newContent = JSON.stringify({ name: 'Alice', age: 31 });

      const diff = computeDataDiff(oldContent, newContent);

      const modifiedPath = diff.pathChanges?.find(c => c.path === 'age' && c.type === 'modified');
      expect(modifiedPath).toBeDefined();
      expect(modifiedPath?.oldValue).toBe(30);
      expect(modifiedPath?.newValue).toBe(31);
    });

    it('should handle nested object changes', () => {
      const oldContent = JSON.stringify({ user: { name: 'Alice', city: 'NYC' } });
      const newContent = JSON.stringify({ user: { name: 'Alice', city: 'LA' } });

      const diff = computeDataDiff(oldContent, newContent);

      const modifiedPath = diff.pathChanges?.find(c => c.path === 'user.city');
      expect(modifiedPath).toBeDefined();
    });
  });

  describe('affected metrics', () => {
    it('should list affected columns for tabular data', () => {
      const oldContent = `name,sales,revenue
Alice,100,1000
Bob,200,2000`;
      const newContent = `name,sales,revenue
Alice,150,1500
Bob,200,2000`;

      const diff = computeDataDiff(oldContent, newContent);

      expect(diff.affectedMetrics).toContain('sales');
      expect(diff.affectedMetrics).toContain('revenue');
    });
  });
});

describe('formatDiffForAI', () => {
  it('should format unchanged diff', () => {
    const diff = computeDataDiff('same', 'same');
    const formatted = formatDiffForAI(diff);

    expect(formatted).toContain('NO CHANGES DETECTED');
  });

  it('should format tabular diff with schema changes', () => {
    const oldContent = `name,value
Alice,100`;
    const newContent = `name,value,status
Alice,100,active`;

    const diff = computeDataDiff(oldContent, newContent);
    const formatted = formatDiffForAI(diff);

    expect(formatted).toContain('CONTENT TYPE: tabular');
    expect(formatted).toContain('NEW COLUMNS: status');
  });

  it('should format domain change warning', () => {
    const oldContent = `name,age
Alice,30`;
    const newContent = `product,price
Widget,29.99`;

    const diff = computeDataDiff(oldContent, newContent);
    const formatted = formatDiffForAI(diff);

    expect(formatted).toContain('DOMAIN CHANGE DETECTED');
    expect(formatted).toContain('regeneration');
  });

  it('should format cell value changes', () => {
    const oldContent = `name,value
Alice,100`;
    const newContent = `name,value
Alice,150`;

    const diff = computeDataDiff(oldContent, newContent);
    const formatted = formatDiffForAI(diff);

    expect(formatted).toContain('CELL VALUE CHANGES');
    expect(formatted).toContain('100');
    expect(formatted).toContain('150');
  });

  it('should include recommendation', () => {
    const oldContent = `name,value
Alice,100`;
    const newContent = `name,value
Alice,150`;

    const diff = computeDataDiff(oldContent, newContent);
    const formatted = formatDiffForAI(diff);

    expect(formatted).toContain('RECOMMENDED APPROACH: SURGICAL');
  });
});
