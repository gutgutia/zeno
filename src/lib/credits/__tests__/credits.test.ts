/**
 * Credit System Unit Tests
 *
 * Tests for credit calculations and business logic.
 * Formula: ceil((input_tokens + output_tokens * 5) / 10000)
 */

import { describe, it, expect } from 'vitest';
import { calculateCredits } from '../index';

describe('calculateCredits', () => {
  describe('basic calculations', () => {
    it('should return 1 credit for minimal token usage', () => {
      expect(calculateCredits(100, 100)).toBe(1);
    });

    it('should return 0 credits for zero tokens', () => {
      // 0 + 0 * 5 = 0, ceil(0 / 10000) = 0
      expect(calculateCredits(0, 0)).toBe(0);
    });

    it('should correctly weight output tokens 5x', () => {
      // 0 + 1000 * 5 = 5000, ceil(5000 / 10000) = 1
      expect(calculateCredits(0, 1000)).toBe(1);

      // 0 + 2000 * 5 = 10000, ceil(10000 / 10000) = 1
      expect(calculateCredits(0, 2000)).toBe(1);

      // 0 + 2001 * 5 = 10005, ceil(10005 / 10000) = 2
      expect(calculateCredits(0, 2001)).toBe(2);
    });

    it('should correctly add input tokens without weighting', () => {
      // 10000 + 0 = 10000, ceil(10000 / 10000) = 1
      expect(calculateCredits(10000, 0)).toBe(1);

      // 10001 + 0 = 10001, ceil(10001 / 10000) = 2
      expect(calculateCredits(10001, 0)).toBe(2);
    });
  });

  describe('combined input and output', () => {
    it('should correctly combine input and weighted output', () => {
      // 5000 + 1000 * 5 = 10000, ceil(10000 / 10000) = 1
      expect(calculateCredits(5000, 1000)).toBe(1);

      // 5000 + 1001 * 5 = 10005, ceil(10005 / 10000) = 2
      expect(calculateCredits(5000, 1001)).toBe(2);
    });

    it('should handle typical generation usage', () => {
      // Typical dashboard generation: ~50k input, ~5k output
      // 50000 + 5000 * 5 = 75000, ceil(75000 / 10000) = 8
      expect(calculateCredits(50000, 5000)).toBe(8);
    });

    it('should handle large generation usage', () => {
      // Large dashboard: ~100k input, ~10k output
      // 100000 + 10000 * 5 = 150000, ceil(150000 / 10000) = 15
      expect(calculateCredits(100000, 10000)).toBe(15);
    });
  });

  describe('ceiling behavior', () => {
    it('should always round up (ceiling)', () => {
      // 1 + 0 = 1, ceil(1 / 10000) = 1 (not 0)
      expect(calculateCredits(1, 0)).toBe(1);

      // 9999 + 0 = 9999, ceil(9999 / 10000) = 1
      expect(calculateCredits(9999, 0)).toBe(1);

      // 10000 + 0 = 10000, ceil(10000 / 10000) = 1
      expect(calculateCredits(10000, 0)).toBe(1);

      // 10001 + 0 = 10001, ceil(10001 / 10000) = 2
      expect(calculateCredits(10001, 0)).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      // 1 million input, 100k output
      // 1000000 + 100000 * 5 = 1500000, ceil(1500000 / 10000) = 150
      expect(calculateCredits(1000000, 100000)).toBe(150);
    });

    it('should handle fractional results correctly', () => {
      // Verify ceiling is applied correctly
      // 15000 + 0 = 15000, ceil(15000 / 10000) = 2
      expect(calculateCredits(15000, 0)).toBe(2);

      // 25000 + 0 = 25000, ceil(25000 / 10000) = 3 (not 2.5)
      expect(calculateCredits(25000, 0)).toBe(3);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle simple dashboard refresh', () => {
      // Typical refresh: ~20k input, ~2k output
      // 20000 + 2000 * 5 = 30000, ceil(30000 / 10000) = 3
      expect(calculateCredits(20000, 2000)).toBe(3);
    });

    it('should handle dashboard modification', () => {
      // Typical modify: ~30k input, ~3k output
      // 30000 + 3000 * 5 = 45000, ceil(45000 / 10000) = 5
      expect(calculateCredits(30000, 3000)).toBe(5);
    });

    it('should handle complex multi-turn generation', () => {
      // Complex generation: ~200k input, ~20k output
      // 200000 + 20000 * 5 = 300000, ceil(300000 / 10000) = 30
      expect(calculateCredits(200000, 20000)).toBe(30);
    });
  });
});
