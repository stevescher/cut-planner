import { describe, it, expect } from 'vitest';
import { csvCell, csvRow, safeFilename } from '@/lib/safe-export';

describe('csvCell — formula injection guard', () => {
  it('neutralizes and quotes a HYPERLINK payload (leading = plus quotes/commas)', () => {
    // Leading '=' gets an apostrophe; embedded quotes doubled; commas force quoting.
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(
      `"'=HYPERLINK(""http://evil"",""x"")"`
    );
  });

  it('prefixes each formula trigger character', () => {
    expect(csvCell('=1+1')).toBe(`'=1+1`);
    expect(csvCell('+1')).toBe(`'+1`);
    expect(csvCell('-1')).toBe(`'-1`);
    expect(csvCell('@SUM(A1)')).toBe(`'@SUM(A1)`);
  });

  it('quotes and escapes cells containing commas, quotes, or newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('leaves an ordinary value untouched', () => {
    expect(csvCell('Side Panel')).toBe('Side Panel');
    expect(csvCell(24)).toBe('24');
  });

  it('quotes a neutralized formula that also contains a comma', () => {
    // Leading '=' → apostrophe prefix, and the comma forces RFC-4180 quoting.
    expect(csvCell('=A1,B1')).toBe(`"'=A1,B1"`);
  });
});

describe('csvRow', () => {
  it('joins escaped cells with commas', () => {
    expect(csvRow(['Top', 24, 12, 1])).toBe('Top,24,12,1');
    expect(csvRow(['=evil', 1])).toBe(`'=evil,1`);
  });
});

describe('safeFilename', () => {
  it('strips path separators and reserved characters', () => {
    expect(safeFilename('../../etc/passwd', 'fallback')).toBe('....etcpasswd');
    expect(safeFilename('a/b\\c:d*e?f', 'fallback')).toBe('abcdef');
  });

  it('falls back when nothing usable remains', () => {
    expect(safeFilename('///', 'cut-planner')).toBe('cut-planner');
    expect(safeFilename('', 'cut-planner')).toBe('cut-planner');
  });

  it('collapses whitespace and trims', () => {
    expect(safeFilename('  My   Project  ', 'x')).toBe('My Project');
  });

  it('caps length', () => {
    expect(safeFilename('a'.repeat(500), 'x').length).toBe(120);
  });
});
