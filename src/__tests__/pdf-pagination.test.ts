import { describe, it, expect } from 'vitest';
import {
  summaryPageCount,
  ROW_H,
  SUMMARY_ROW_BOTTOM_MARGIN,
  SUMMARY_HEADER_STARTS,
} from '@/lib/export/pdf';

const pageH = 8.5; // letter landscape height (in)
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
