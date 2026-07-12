import { Solution, StockSheet } from './optimizer/types';

/** Cost line for a single stock-sheet type used in a solution. */
export interface CostLine {
  stockSheetId: string;
  label: string;
  sheetsUsed: number;
  /** Undefined when the stock sheet has no price set. */
  pricePerSheet?: number;
  /** sheetsUsed × pricePerSheet, or undefined when unpriced. */
  subtotal?: number;
}

export interface CostBreakdown {
  lines: CostLine[];
  /** Sum of priced subtotals. Unpriced sheets contribute nothing. */
  grandTotal: number;
  /** True when at least one used sheet type has a price set. */
  hasPricing: boolean;
  /** True when at least one used sheet type is missing a price (partial estimate). */
  hasUnpriced: boolean;
}

/**
 * Compute a per-stock-type material cost breakdown for a solution.
 *
 * Sheets are counted from the actual placed layout (`solution.sheets`), so the
 * count reflects sheets used, not the quantity the user made available. A stock
 * type with no `pricePerSheet` is listed with an undefined subtotal and excluded
 * from the grand total.
 */
export function computeCost(solution: Solution, stockSheets: StockSheet[]): CostBreakdown {
  const usedCount = new Map<string, number>();
  for (const sheet of solution.sheets) {
    usedCount.set(sheet.stockSheetId, (usedCount.get(sheet.stockSheetId) ?? 0) + 1);
  }

  const lines: CostLine[] = [];
  let grandTotal = 0;
  let hasPricing = false;
  let hasUnpriced = false;

  for (const [stockSheetId, sheetsUsed] of usedCount) {
    const stock = stockSheets.find((s) => s.id === stockSheetId);
    const price = stock?.pricePerSheet;
    const priced = typeof price === 'number' && isFinite(price) && price >= 0;
    const subtotal = priced ? price * sheetsUsed : undefined;

    if (priced) {
      hasPricing = true;
      grandTotal += subtotal!;
    } else {
      hasUnpriced = true;
    }

    lines.push({
      stockSheetId,
      label: stock?.label || 'Untitled sheet',
      sheetsUsed,
      pricePerSheet: priced ? price : undefined,
      subtotal,
    });
  }

  return { lines, grandTotal, hasPricing, hasUnpriced };
}

/** Upper bound for a per-sheet price, mirrored by the import validator. */
export const MAX_PRICE = 1_000_000;

/**
 * Parse a user-entered price string into a validated number.
 *
 * Returns `undefined` for empty input (an explicitly unpriced sheet) and `null`
 * for anything invalid — a partial/garbage entry ("12abc"), a negative, or an
 * out-of-range value. A bare `$` prefix and thousands separators are stripped
 * first, but the *entire* remainder must be a plain number: unlike `parseFloat`,
 * this never silently accepts a numeric prefix and stores a wrong price.
 */
export function parsePrice(input: string): number | undefined | null {
  const trimmed = input.trim();
  if (trimmed === '') return undefined;
  const normalized = trimmed.replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d*\.?\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!isFinite(parsed) || parsed < 0 || parsed > MAX_PRICE) return null;
  return parsed;
}

/** Format a number as a plain "$1,234.56" string (display-only, no locale conversion). */
export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
