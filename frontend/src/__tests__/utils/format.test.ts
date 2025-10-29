import { formatBytes, formatDate } from '../../lib/utils';

describe('Format Utilities', () => {
  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('handles decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 2)).toBe('1.5 KB');
    });

    it('handles large numbers', () => {
      const result = formatBytes(1099511627776);
      expect(result).toContain('TB');
    });

    it('handles string inputs (BigInt serialization)', () => {
      expect(formatBytes('1024')).toBe('1 KB');
      expect(formatBytes('1048576')).toBe('1 MB');
      expect(formatBytes('0')).toBe('0 Bytes');
    });

    it('handles invalid inputs', () => {
      expect(formatBytes('invalid')).toBe('0 Bytes');
      expect(formatBytes(NaN)).toBe('0 Bytes');
    });
  });

  describe('formatDate', () => {
    it('formats date strings', () => {
      const date = '2024-01-15T10:30:00Z';
      const formatted = formatDate(date);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('formats Date objects', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('handles invalid date strings', () => {
      expect(formatDate('invalid-date')).toBe('Invalid date');
      expect(formatDate('')).toBe('Unknown date');
      expect(formatDate(null as any)).toBe('Unknown date');
      expect(formatDate(undefined as any)).toBe('Unknown date');
    });

    it('handles timestamp strings', () => {
      const timestamp = '1705312200000'; // 2024-01-15T10:30:00Z
      const formatted = formatDate(timestamp);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });
});

