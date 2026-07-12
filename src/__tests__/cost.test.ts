import { describe, it, expect } from 'vitest';
import { computeCost, formatCurrency, parsePrice, MAX_PRICE } from '@/lib/cost';
import { Solution, StockSheet, SheetLayout } from '@/lib/optimizer/types';

function stock(id: string, overrides: Partial<StockSheet> = {}): StockSheet {
  return {
    id,
    label: id,
    length: 96,
    width: 48,
    quantity: 10,
    trimTop: 0,
    trimRight: 0,
    trimBottom: 0,
    trimLeft: 0,
    ...overrides,
  };
}

function sheetLayout(stockSheetId: string, sheetIndex: number): SheetLayout {
  return {
    stockSheetId,
    sheetIndex,
    placements: [],
    cutSequence: [],
    wastePercent: 0,
    usedArea: 0,
  };
}

function solution(sheets: SheetLayout[]): Solution {
  return {
    id: 's1',
    strategyName: 'test',
    sheets,
    totalWaste: 0,
    totalSheets: sheets.length,
    unplacedPanels: [],
  };
}

describe('computeCost', () => {
  it('returns no pricing when no used sheet has a price', () => {
    const cost = computeCost(
      solution([sheetLayout('a', 0), sheetLayout('a', 1)]),
      [stock('a')]
    );
    expect(cost.hasPricing).toBe(false);
    expect(cost.grandTotal).toBe(0);
    expect(cost.lines).toHaveLength(1);
    expect(cost.lines[0].sheetsUsed).toBe(2);
    expect(cost.lines[0].subtotal).toBeUndefined();
  });

  it('multiplies sheets used by price per type', () => {
    const cost = computeCost(
      solution([sheetLayout('a', 0), sheetLayout('a', 1), sheetLayout('b', 0)]),
      [stock('a', { pricePerSheet: 50 }), stock('b', { pricePerSheet: 30 })]
    );
    expect(cost.hasPricing).toBe(true);
    expect(cost.hasUnpriced).toBe(false);
    // 2×50 + 1×30 = 130
    expect(cost.grandTotal).toBe(130);
    const a = cost.lines.find((l) => l.stockSheetId === 'a')!;
    expect(a.sheetsUsed).toBe(2);
    expect(a.subtotal).toBe(100);
  });

  it('counts sheets actually used, not the available quantity', () => {
    // stock quantity is 10 but only 1 sheet is placed in the solution
    const cost = computeCost(
      solution([sheetLayout('a', 0)]),
      [stock('a', { quantity: 10, pricePerSheet: 25 })]
    );
    expect(cost.lines[0].sheetsUsed).toBe(1);
    expect(cost.grandTotal).toBe(25);
  });

  it('treats a $0 price as priced (free), distinct from unpriced', () => {
    const cost = computeCost(
      solution([sheetLayout('a', 0)]),
      [stock('a', { pricePerSheet: 0 })]
    );
    expect(cost.hasPricing).toBe(true);
    expect(cost.lines[0].subtotal).toBe(0);
    expect(cost.lines[0].pricePerSheet).toBe(0);
  });

  it('reports a partial estimate when some used types are unpriced', () => {
    const cost = computeCost(
      solution([sheetLayout('a', 0), sheetLayout('b', 0)]),
      [stock('a', { pricePerSheet: 40 }), stock('b')]
    );
    expect(cost.hasPricing).toBe(true);
    expect(cost.hasUnpriced).toBe(true);
    expect(cost.grandTotal).toBe(40); // only priced type contributes
  });

  it('ignores negative or non-finite prices (treats as unpriced)', () => {
    const cost = computeCost(
      solution([sheetLayout('a', 0)]),
      [stock('a', { pricePerSheet: -5 })]
    );
    expect(cost.hasPricing).toBe(false);
    expect(cost.lines[0].subtotal).toBeUndefined();
  });
});

describe('parsePrice', () => {
  it('returns undefined for empty / whitespace (unpriced)', () => {
    expect(parsePrice('')).toBeUndefined();
    expect(parsePrice('   ')).toBeUndefined();
  });

  it('parses plain numbers', () => {
    expect(parsePrice('50')).toBe(50);
    expect(parsePrice('65.50')).toBe(65.5);
    expect(parsePrice('0')).toBe(0);
    expect(parsePrice('.5')).toBe(0.5);
  });

  it('strips a $ prefix and thousands separators', () => {
    expect(parsePrice('$50')).toBe(50);
    expect(parsePrice('1,000')).toBe(1000);
    expect(parsePrice('$1,234.56')).toBe(1234.56);
  });

  it('rejects a numeric prefix instead of accepting it (the Codex bug)', () => {
    // parseFloat would return 12 and 1 here — parsePrice must reject.
    expect(parsePrice('12abc')).toBeNull();
    expect(parsePrice('1.2.3')).toBeNull();
    expect(parsePrice('5px')).toBeNull();
  });

  it('rejects negatives and out-of-range values', () => {
    expect(parsePrice('-5')).toBeNull();
    expect(parsePrice(String(MAX_PRICE + 1))).toBeNull();
  });

  it('accepts the max price boundary', () => {
    expect(parsePrice(String(MAX_PRICE))).toBe(MAX_PRICE);
  });
});

describe('formatCurrency', () => {
  it('formats with two decimals and thousands separators', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(50)).toBe('$50.00');
  });
});
