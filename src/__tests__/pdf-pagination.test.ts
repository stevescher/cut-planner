import { describe, it, expect } from 'vitest';
import {
  summaryPageCount,
  costPageCount,
  sheetPageCount,
  sheetDiagramMetrics,
  ROW_H,
  SUMMARY_ROW_BOTTOM_MARGIN,
  SUMMARY_HEADER_STARTS,
  COST_GEOMETRY,
  CUTLIST_GEOMETRY,
} from '@/lib/export/pdf';

const pageH = 8.5; // letter landscape height (in)
const pageW = 11;  // letter landscape width (in)
const margin = 0.5;

/**
 * Faithfully simulate drawSummaryPage's render loop and count how many pages
 * it actually produces. The predicted summaryPageCount must equal this for
 * every panel count, or footer numbering drifts.
 */
function renderedPageCount(panelCount: number): number {
  const headerStart = (first: boolean) =>
    margin + (first ? SUMMARY_HEADER_STARTS.first : SUMMARY_HEADER_STARTS.cont);
  const firstRowY = (first: boolean) => headerStart(first) + SUMMARY_HEADER_STARTS.headerHeight;
  const rowBottom = pageH - margin - SUMMARY_ROW_BOTTOM_MARGIN;

  let pages = 1;
  let y = firstRowY(true);
  for (let i = 0; i < panelCount; i++) {
    if (y > rowBottom) {
      pages++;
      y = firstRowY(false);
    }
    y += ROW_H;
  }
  return pages;
}

describe('PDF summary pagination', () => {
  it('predicted page count matches the rendered count for 1..300 panels', () => {
    for (let n = 1; n <= 300; n++) {
      expect(summaryPageCount(n, pageH, margin)).toBe(renderedPageCount(n));
    }
  });

  it('a single panel fits on one page', () => {
    expect(summaryPageCount(1, pageH, margin)).toBe(1);
  });

  it('spills to multiple pages for a large list', () => {
    expect(summaryPageCount(200, pageH, margin)).toBeGreaterThan(1);
  });
});

/**
 * Faithfully simulate drawCostPage's render loop: rows are laid out at COST_ROW_H
 * and every page reserves space for the grand-total block (uniform capacity), so
 * a new page starts when a row would cross that reserved bottom. The predicted
 * costPageCount must equal this for every line count, or rows get silently
 * dropped — the bug Codex flagged.
 */
function renderedCostPages(lineCount: number): number {
  const { rowH, firstRowY, rowBottomMargin, totalBlockH } = COST_GEOMETRY;
  const rowBottom = pageH - margin - rowBottomMargin - totalBlockH;

  let pageIdx = 0;
  let y = margin + firstRowY;
  for (let i = 0; i < lineCount; i++) {
    if (y > rowBottom) {
      pageIdx++;
      y = margin + firstRowY;
    }
    y += rowH;
  }
  return pageIdx + 1;
}

describe('PDF cost pagination', () => {
  it('returns 0 pages when unpriced or empty', () => {
    expect(costPageCount(0, false, pageH, margin)).toBe(0);
    expect(costPageCount(5, false, pageH, margin)).toBe(0);
    expect(costPageCount(0, true, pageH, margin)).toBe(0);
  });

  it('renders every cost line — predicted pages match the render loop for 1..50 lines', () => {
    // 50 = the import validator's stock-sheet ceiling, so the max real line count.
    for (let n = 1; n <= 50; n++) {
      expect(costPageCount(n, true, pageH, margin)).toBe(renderedCostPages(n));
    }
  });

  it('fits a small breakdown on a single page', () => {
    expect(costPageCount(3, true, pageH, margin)).toBe(1);
  });

  it('spills to multiple pages when lines exceed one page capacity', () => {
    expect(costPageCount(50, true, pageH, margin)).toBeGreaterThan(1);
  });
});

/**
 * Faithfully simulate drawSheetPage's cut-list render loop (OPUS-404): the first
 * page's list starts below the diagram (cutListTop); continuation pages are
 * cut-list-only starting at contTop. A new page begins when a row would cross
 * the bottom margin. The predicted sheetPageCount must equal this for every
 * placement count, or footer numbering drifts and (pre-fix) rows are dropped.
 */
function renderedSheetPages(placementCount: number, sheetW: number, sheetH: number): number {
  const { rowH, headerH, contTop, bottomMargin } = CUTLIST_GEOMETRY;
  const { cutListTop } = sheetDiagramMetrics(sheetW, sheetH, pageW, pageH, margin);
  const firstRowY = (first: boolean) => (first ? cutListTop : margin + contTop) + headerH;
  const rowBottom = pageH - margin - bottomMargin;

  let pageIdx = 0;
  let y = firstRowY(true);
  for (let i = 0; i < placementCount; i++) {
    if (y > rowBottom) {
      pageIdx++;
      y = firstRowY(false);
    }
    y += rowH;
  }
  return pageIdx + 1;
}

describe('PDF per-sheet cut-list pagination (OPUS-404)', () => {
  // A 96x48 sheet — the common full-sheet case (small diagram-below space).
  const W = 96;
  const H = 48;

  it('predicted page count matches the render loop for 1..300 placements', () => {
    for (let n = 1; n <= 300; n++) {
      expect(sheetPageCount(n, W, H, pageW, pageH, margin)).toBe(renderedSheetPages(n, W, H));
    }
  });

  it('a sparse sheet fits on a single page', () => {
    expect(sheetPageCount(3, W, H, pageW, pageH, margin)).toBe(1);
    expect(sheetPageCount(0, W, H, pageW, pageH, margin)).toBe(1);
  });

  it('a dense sheet spills onto continuation pages (no silent drop)', () => {
    // Before the fix, drawSheetPage silently truncated at the overflow guard.
    // Now a dense cut list must occupy more than one page.
    expect(sheetPageCount(60, W, H, pageW, pageH, margin)).toBeGreaterThan(1);
  });

  it('never returns fewer than 1 page', () => {
    expect(sheetPageCount(0, W, H, pageW, pageH, margin)).toBeGreaterThanOrEqual(1);
  });
});
