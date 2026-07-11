import { describe, it, expect } from 'vitest';
import { parseCSV } from '@/components/forms/PanelImport';

describe('parseCSV', () => {
  it('splits simple rows and columns', () => {
    expect(parseCSV('label,length,width,qty\nA,24,12,2')).toEqual([
      ['label', 'length', 'width', 'qty'],
      ['A', '24', '12', '2'],
    ]);
  });

  it('keeps a comma inside a quoted field', () => {
    expect(parseCSV('label,length\n"Side, left",24')).toEqual([
      ['label', 'length'],
      ['Side, left', '24'],
    ]);
  });

  it('keeps a NEWLINE inside a quoted field (Excel multi-line cell)', () => {
    const csv = 'label,length\n"Left\nPanel",24\nShelf,30';
    expect(parseCSV(csv)).toEqual([
      ['label', 'length'],
      ['Left\nPanel', '24'],
      ['Shelf', '30'],
    ]);
  });

  it('handles escaped double-quotes', () => {
    expect(parseCSV('label\n"3"" board"')).toEqual([['label'], ['3" board']]);
  });

  it('drops fully-empty rows', () => {
    expect(parseCSV('A,1\n\n\nB,2\n')).toEqual([['A', '1'], ['B', '2']]);
  });
});
