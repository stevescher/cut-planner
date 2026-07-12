import { describe, it, expect } from 'vitest';
import { parseStrictNumber, parseMetric, parseInput, parseDimension } from '@/lib/fractions';

const MM_PER_INCH = 25.4;

describe('parseStrictNumber (OPUS-406)', () => {
  it('accepts full numeric tokens', () => {
    expect(parseStrictNumber('12')).toBe(12);
    expect(parseStrictNumber('12.5')).toBe(12.5);
    expect(parseStrictNumber('0.5')).toBe(0.5);
    expect(parseStrictNumber('.5')).toBe(0.5);
    expect(parseStrictNumber('  7 ')).toBe(7); // surrounding whitespace ok
  });

  it('rejects numeric-prefix garbage instead of silently coercing it', () => {
    expect(parseStrictNumber('12abc')).toBeNaN();
    expect(parseStrictNumber('1.2.3')).toBeNaN();
    expect(parseStrictNumber('3x')).toBeNaN();
    expect(parseStrictNumber('abc')).toBeNaN();
    expect(parseStrictNumber('')).toBeNaN();
    expect(parseStrictNumber('12 34')).toBeNaN();
    expect(parseStrictNumber('1e3')).toBeNaN(); // exponent notation not a dimension
  });
});

describe('parseMetric strictness (OPUS-406)', () => {
  it('parses valid metric values (with optional mm suffix)', () => {
    expect(parseMetric('254')).toBeCloseTo(254 / MM_PER_INCH, 6); // 254 mm = 10"
    expect(parseMetric('254mm')).toBeCloseTo(254 / MM_PER_INCH, 6);
    expect(parseMetric('254 mm')).toBeCloseTo(254 / MM_PER_INCH, 6);
    expect(parseMetric('12.5')).toBeCloseTo(12.5 / MM_PER_INCH, 6);
  });

  it('rejects numeric-prefix garbage that parseFloat would have accepted', () => {
    // Pre-fix: "12abc" → parseFloat 12 → 0.472". Now → NaN.
    expect(parseMetric('12abc')).toBeNaN();
    expect(parseMetric('1.2.3')).toBeNaN();
    expect(parseMetric('abc')).toBeNaN();
    expect(parseMetric('')).toBeNaN();
  });

  it('routes through parseInput in metric mode', () => {
    expect(parseInput('12abc', 'metric')).toBeNaN();
    expect(parseInput('254', 'metric')).toBeCloseTo(254 / MM_PER_INCH, 6);
  });
});

describe('imperial parseDimension unchanged (regression guard)', () => {
  it('still parses decimals, fractions, and mixed numbers', () => {
    expect(parseDimension('12')).toBe(12);
    expect(parseDimension('12.5')).toBe(12.5);
    expect(parseDimension('1/8')).toBeCloseTo(0.125, 6);
    expect(parseDimension('12 1/2')).toBeCloseTo(12.5, 6);
    expect(parseDimension('12-1/2')).toBeCloseTo(12.5, 6);
  });

  it('still rejects garbage', () => {
    expect(parseDimension('12abc')).toBeNaN();
    expect(parseDimension('1.2.3')).toBeNaN();
  });
});
