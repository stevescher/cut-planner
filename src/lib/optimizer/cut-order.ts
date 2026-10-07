import { CutPreference, Placement, SheetLayout, StockSheet } from './types';

/** Saw-line orientation on the canvas. A rip is horizontal (along the sheet length). */
export type CutAxis = 'horizontal' | 'vertical';

/** The first-cut orientation a preference asks for, or null for 'auto'. */
export function preferredFirstCut(pref: CutPreference | undefined): CutAxis | null {
  switch (pref) {
    case 'favor-rip':
    case 'always-rip':
      return 'horizontal';
    case 'favor-crosscut':
    case 'always-crosscut':
      return 'vertical';
    default:
      return null;
  }
}

/** True for the 'always-*' preferences, which outrank sheet count. */
export function isHardCutPreference(pref: CutPreference | undefined): boolean {
  return pref === 'always-rip' || pref === 'always-crosscut';
}

/** Same tolerance deriveCutSequenceFromPlacements uses to decide a piece straddles a cut. */
const POS_EPS = 0.05;

/** True when a straight cut at `pos` along `axis` crosses the region without passing through a piece. */
function hasCleanCut(
  placements: Placement[],
  axis: CutAxis,
  lo: number,
  hi: number,
): boolean {
  for (const p of placements) {
    const edges = axis === 'horizontal' ? [p.y, p.y + p.height] : [p.x, p.x + p.width];
    for (const pos of edges) {
      if (pos <= lo + POS_EPS || pos >= hi - POS_EPS) continue;
      const blocked = placements.some((q) =>
        axis === 'horizontal'
          ? q.y < pos - POS_EPS && q.y + q.height > pos + POS_EPS
          : q.x < pos - POS_EPS && q.x + q.width > pos + POS_EPS,
      );
      if (!blocked) return true;
    }
  }
  return false;
}

/**
 * Whether a sheet's layout can start with a full-span cut in the given
 * direction, across the usable (post-trim) area. A sheet that needs no cut in
 * either direction, such as one part filling it or a non-guillotine layout,
 * conforms to both directions.
 */
export function sheetAllowsFirstCut(
  placements: Placement[],
  stock: StockSheet,
  axis: CutAxis,
): boolean {
  if (placements.length === 0) return true;
  const x0 = stock.trimLeft;
  const x1 = stock.length - stock.trimRight;
  const y0 = stock.trimTop;
  const y1 = stock.width - stock.trimBottom;
  const h = hasCleanCut(placements, 'horizontal', y0, y1);
  const v = hasCleanCut(placements, 'vertical', x0, x1);
  if (!h && !v) return true;
  return axis === 'horizontal' ? h : v;
}

/**
 * Cut-order conformance summary for a solution's sheets, or undefined when the
 * preference is 'auto' (nothing to conform to).
 */
export function evaluateCutOrder(
  sheets: SheetLayout[],
  stockSheets: StockSheet[],
  pref: CutPreference | undefined,
): { preference: CutPreference; mismatchedSheets: number } | undefined {
  const axis = preferredFirstCut(pref);
  if (!axis || !pref) return undefined;
  let mismatchedSheets = 0;
  for (const sheet of sheets) {
    const stock = stockSheets.find((s) => s.id === sheet.stockSheetId);
    if (stock && !sheetAllowsFirstCut(sheet.placements, stock, axis)) mismatchedSheets++;
  }
  return { preference: pref, mismatchedSheets };
}
