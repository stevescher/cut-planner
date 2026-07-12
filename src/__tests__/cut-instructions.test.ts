import { describe, it, expect } from 'vitest';
import { describeCut, describeSheetCuts } from '@/lib/cut-instructions';
import { CutStep, SheetLayout } from '@/lib/optimizer/types';

// Raw sheet used across cases: 96 (length, x-axis) × 48 (width, y-axis).
const SHEET_L = 96;
const SHEET_W = 48;

function step(overrides: Partial<CutStep>): CutStep {
  return {
    stepNumber: 1,
    orientation: 'vertical',
    x1: 0, y1: 0, x2: 0, y2: 0,
    segments: [],
    ...overrides,
  };
}

describe('describeCut — rip vs crosscut convention', () => {
  it('labels a horizontal cut (along the length) as a Rip, measured from the top', () => {
    // Horizontal cut at y=24, spanning inside the usable length (not edge-to-edge).
    const cut = describeCut(
      step({ orientation: 'horizontal', x1: 0, y1: 24, x2: 90, y2: 24 }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.kind).toBe('rip');
    expect(cut.label).toBe('Rip to 24"');
    expect(cut.measurement).toBe('24"');
    expect(cut.fromEdge).toBe('top');
  });

  it('labels a vertical cut (across the length) as a Crosscut, measured from the left', () => {
    // Vertical cut at x=30, spanning inside the usable width.
    const cut = describeCut(
      step({ orientation: 'vertical', x1: 30, y1: 0, x2: 30, y2: 44 }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.kind).toBe('crosscut');
    expect(cut.label).toBe('Crosscut to 30"');
    expect(cut.measurement).toBe('30"');
    expect(cut.fromEdge).toBe('left');
  });
});

describe('describeCut — trim (square the stock) detection', () => {
  it('detects a vertical trim spanning the full sheet height', () => {
    // Trim cuts run edge-to-edge of the RAW sheet: y 0 → sheetWidth.
    const cut = describeCut(
      step({ orientation: 'vertical', x1: 0.25, y1: 0, x2: 0.25, y2: SHEET_W }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.kind).toBe('trim');
    expect(cut.label).toContain('Square the stock');
  });

  it('detects a horizontal trim spanning the full sheet width', () => {
    const cut = describeCut(
      step({ orientation: 'horizontal', x1: 0, y1: 0.25, x2: SHEET_L, y2: 0.25 }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.kind).toBe('trim');
    expect(cut.label).toContain('Square the stock');
  });

  it('does NOT treat a usable-area rip as a trim even when it spans most of the length', () => {
    // A rip inside the usable region starts at the trim inset (x=0.25), not 0,
    // so it must not be misread as square-the-stock.
    const cut = describeCut(
      step({ orientation: 'horizontal', x1: 0.25, y1: 24, x2: SHEET_L - 0.25, y2: 24 }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.kind).toBe('rip');
  });
});

describe('describeCut — approximate flag and units', () => {
  it('carries the approximate flag through', () => {
    const cut = describeCut(
      step({ orientation: 'vertical', x1: 30, y1: 0, x2: 30, y2: 44, approximate: true }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.approximate).toBe(true);
  });

  it('defaults approximate to false when the flag is absent', () => {
    const cut = describeCut(
      step({ orientation: 'vertical', x1: 30, y1: 0, x2: 30, y2: 44 }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.approximate).toBe(false);
  });

  it('formats measurements in metric (mm) when requested', () => {
    // 30 inches → 762 mm.
    const cut = describeCut(
      step({ orientation: 'vertical', x1: 30, y1: 0, x2: 30, y2: 44 }),
      'metric', SHEET_L, SHEET_W,
    );
    expect(cut.measurement).toBe('762 mm');
    expect(cut.label).toBe('Crosscut to 762 mm');
  });
});

describe('describeSheetCuts — preserves order and numbering', () => {
  it('translates every step in sequence order', () => {
    const sheet: SheetLayout = {
      stockSheetId: 's1',
      sheetIndex: 0,
      placements: [],
      cutSequence: [
        step({ stepNumber: 1, orientation: 'vertical', x1: 0.25, y1: 0, x2: 0.25, y2: SHEET_W }), // trim
        step({ stepNumber: 2, orientation: 'horizontal', x1: 0.25, y1: 24, x2: 90, y2: 24 }),      // rip
        step({ stepNumber: 3, orientation: 'vertical', x1: 30, y1: 0, x2: 30, y2: 44 }),           // crosscut
      ],
      wastePercent: 0,
      usedArea: 0,
    };
    const cuts = describeSheetCuts(sheet, 'imperial', SHEET_L, SHEET_W);
    expect(cuts.map((c) => c.kind)).toEqual(['trim', 'rip', 'crosscut']);
    expect(cuts.map((c) => c.stepNumber)).toEqual([1, 2, 3]);
  });
});
