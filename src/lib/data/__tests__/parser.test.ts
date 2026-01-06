/**
 * Data Parser Unit Tests
 *
 * Tests for CSV/Excel parsing and schema generation.
 */

import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  detectDelimiter,
  generateSchema,
} from '../parser';

describe('parseCSV', () => {
  describe('basic CSV parsing', () => {
    it('should parse simple CSV with headers', () => {
      const csv = `name,age,city
Alice,30,NYC
Bob,25,LA
Charlie,35,Chicago`;

      const result = parseCSV(csv);

      expect(result.columns).toEqual(['name', 'age', 'city']);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toEqual({ name: 'Alice', age: 30, city: 'NYC' });
      expect(result.rows[1]).toEqual({ name: 'Bob', age: 25, city: 'LA' });
      expect(result.rows[2]).toEqual({ name: 'Charlie', age: 35, city: 'Chicago' });
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty lines', () => {
      const csv = `name,value
Alice,100

Bob,200`;

      const result = parseCSV(csv);

      expect(result.rows).toHaveLength(2);
    });

    it('should trim header whitespace', () => {
      const csv = `  name  , age ,  city
Alice,30,NYC`;

      const result = parseCSV(csv);

      expect(result.columns).toEqual(['name', 'age', 'city']);
    });
  });

  describe('dynamic typing', () => {
    it('should convert numeric strings to numbers', () => {
      const csv = `name,value,rate
Product A,100,0.15
Product B,200,0.25`;

      const result = parseCSV(csv);

      expect(result.rows[0].value).toBe(100);
      expect(result.rows[0].rate).toBe(0.15);
      expect(typeof result.rows[0].value).toBe('number');
      expect(typeof result.rows[0].rate).toBe('number');
    });

    it('should handle boolean-like values', () => {
      const csv = `name,active
Alice,true
Bob,false`;

      const result = parseCSV(csv);

      expect(result.rows[0].active).toBe(true);
      expect(result.rows[1].active).toBe(false);
    });

    it('should keep non-numeric strings as strings', () => {
      const csv = `name,description
Alice,A user named Alice`;

      const result = parseCSV(csv);

      expect(typeof result.rows[0].name).toBe('string');
      expect(typeof result.rows[0].description).toBe('string');
    });
  });

  describe('special characters', () => {
    it('should handle quoted values with commas', () => {
      const csv = `name,address
Alice,"123 Main St, Apt 4"
Bob,"456 Oak Ave, Suite 200"`;

      const result = parseCSV(csv);

      expect(result.rows[0].address).toBe('123 Main St, Apt 4');
      expect(result.rows[1].address).toBe('456 Oak Ave, Suite 200');
    });

    it('should handle quoted values with newlines', () => {
      const csv = `name,notes
Alice,"Line 1
Line 2"`;

      const result = parseCSV(csv);

      expect(result.rows[0].notes).toBe('Line 1\nLine 2');
    });

    it('should handle escaped quotes', () => {
      const csv = `name,quote
Alice,"She said ""Hello"""`;

      const result = parseCSV(csv);

      expect(result.rows[0].quote).toBe('She said "Hello"');
    });
  });

  describe('edge cases', () => {
    it('should handle single column CSV', () => {
      const csv = `name
Alice
Bob`;

      const result = parseCSV(csv);

      expect(result.columns).toEqual(['name']);
      expect(result.rows).toHaveLength(2);
    });

    it('should handle single row CSV', () => {
      const csv = `name,age
Alice,30`;

      const result = parseCSV(csv);

      expect(result.rows).toHaveLength(1);
    });

    it('should handle empty CSV', () => {
      const csv = '';

      const result = parseCSV(csv);

      expect(result.rows).toHaveLength(0);
    });

    it('should handle missing values', () => {
      const csv = `name,age,city
Alice,30,
Bob,,LA`;

      const result = parseCSV(csv);

      // Empty values are converted to null by PapaParse's dynamicTyping
      expect(result.rows[0].city).toBeNull();
      expect(result.rows[1].age).toBeNull();
    });
  });
});

describe('detectDelimiter', () => {
  it('should detect comma delimiter', () => {
    const text = `name,age,city
Alice,30,NYC`;

    expect(detectDelimiter(text)).toBe(',');
  });

  it('should detect tab delimiter', () => {
    const text = `name\tage\tcity
Alice\t30\tNYC`;

    expect(detectDelimiter(text)).toBe('\t');
  });

  it('should prefer tabs when more tabs than commas', () => {
    const text = `name\tage\tcity,state
Alice\t30\tNYC,NY`;

    expect(detectDelimiter(text)).toBe('\t');
  });

  it('should default to comma for ambiguous cases', () => {
    const text = `name
Alice`;

    expect(detectDelimiter(text)).toBe(',');
  });
});

describe('generateSchema', () => {
  it('should infer numeric column type', () => {
    const parsedData = {
      rows: [
        { name: 'A', value: 100 },
        { name: 'B', value: 200 },
        { name: 'C', value: 300 },
      ],
      columns: ['name', 'value'],
      errors: [],
    };

    const schema = generateSchema(parsedData);

    const valueCol = schema.columns.find(c => c.name === 'value');
    expect(valueCol?.type).toBe('number');
    expect(valueCol?.stats?.min).toBe(100);
    expect(valueCol?.stats?.max).toBe(300);
    expect(valueCol?.stats?.avg).toBe(200);
  });

  it('should infer string column type', () => {
    const parsedData = {
      rows: [
        { name: 'Alice', city: 'NYC' },
        { name: 'Bob', city: 'LA' },
      ],
      columns: ['name', 'city'],
      errors: [],
    };

    const schema = generateSchema(parsedData);

    const nameCol = schema.columns.find(c => c.name === 'name');
    expect(nameCol?.type).toBe('string');
  });

  it('should detect categorical string columns', () => {
    // Need enough rows so uniqueValues.length < rows.length * 0.5
    // With 3 unique values, need at least 7 rows (3 < 3.5)
    const parsedData = {
      rows: [
        { status: 'active' },
        { status: 'inactive' },
        { status: 'active' },
        { status: 'pending' },
        { status: 'active' },
        { status: 'inactive' },
        { status: 'active' },
      ],
      columns: ['status'],
      errors: [],
    };

    const schema = generateSchema(parsedData);

    const statusCol = schema.columns.find(c => c.name === 'status');
    expect(statusCol?.uniqueValues).toBeDefined();
    expect(statusCol?.uniqueValues).toContain('active');
    expect(statusCol?.uniqueValues).toContain('inactive');
    expect(statusCol?.uniqueValues).toContain('pending');
  });

  it('should detect nullable columns', () => {
    const parsedData = {
      rows: [
        { name: 'Alice', value: 100 },
        { name: 'Bob', value: null },
        { name: 'Charlie', value: 200 },
      ],
      columns: ['name', 'value'],
      errors: [],
    };

    const schema = generateSchema(parsedData);

    const valueCol = schema.columns.find(c => c.name === 'value');
    expect(valueCol?.nullable).toBe(true);
  });

  it('should include row count and sample rows', () => {
    const parsedData = {
      rows: [
        { a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 },
        { a: 6 }, { a: 7 }, { a: 8 }, { a: 9 }, { a: 10 },
      ],
      columns: ['a'],
      errors: [],
    };

    const schema = generateSchema(parsedData);

    expect(schema.rowCount).toBe(10);
    expect(schema.sampleRows).toHaveLength(5);
  });

  it('should detect date columns', () => {
    // Use date formats that won't be confused with numbers
    const parsedData = {
      rows: [
        { date: 'January 15, 2024' },
        { date: 'February 20, 2024' },
        { date: 'March 25, 2024' },
      ],
      columns: ['date'],
      errors: [],
    };

    const schema = generateSchema(parsedData);

    const dateCol = schema.columns.find(c => c.name === 'date');
    expect(dateCol?.type).toBe('date');
  });

  it('should handle boolean columns', () => {
    const parsedData = {
      rows: [
        { active: true },
        { active: false },
        { active: true },
      ],
      columns: ['active'],
      errors: [],
    };

    const schema = generateSchema(parsedData);

    const activeCol = schema.columns.find(c => c.name === 'active');
    expect(activeCol?.type).toBe('boolean');
  });
});
