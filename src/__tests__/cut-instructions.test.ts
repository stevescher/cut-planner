import { describe, it, expect } from 'vitest';
import { describeCut, describeSheetCuts } from '@/lib/cut-instructions';
import { deriveCutSequenceFromPlacements } from '@/lib/optimizer/reoptimize';
import { CutStep, SheetLayout, Placement } from '@/lib/optimizer/types';

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

  // OPUS-403: a zero-trim full-span cut is NOT a trim. When the step carries a
  // `kind`, that wins over the imprecise full-span geometry heuristic.
  it('a stamped crosscut spanning the full sheet height is a crosscut, not a trim', () => {
    const cut = describeCut(
      step({ orientation: 'vertical', kind: 'crosscut', x1: 95.9, y1: 0, x2: 95.9, y2: SHEET_W }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.kind).toBe('crosscut');
    expect(cut.label).not.toContain('Square the stock');
  });

  it('a stamped rip spanning the full sheet length is a rip, not a trim', () => {
    const cut = describeCut(
      step({ orientation: 'horizontal', kind: 'rip', x1: 0, y1: 47.9, x2: SHEET_L, y2: 47.9 }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.kind).toBe('rip');
  });

  it('a stamped trim is still labeled square-the-stock', () => {
    const cut = describeCut(
      step({ orientation: 'vertical', kind: 'trim', x1: 0.25, y1: 0, x2: 0.25, y2: SHEET_W }),
      'imperial', SHEET_L, SHEET_W,
    );
    expect(cut.kind).toBe('trim');
    expect(cut.label).toContain('Square the stock');
  });
});

describe('deriveCutSequenceFromPlacements → describeCut (end-to-end, OPUS-403)', () => {
  function placement(overrides: Partial<Placement>): Placement {
    return {
      panelId: 'p', label: 'P', x: 0, y: 0, width: 10, height: 10,
      rotated: false, pinned: false, color: '#111', ...overrides,
    };
  }

  it('labels the piece-freeing cut of a 95.9" panel on a zero-trim 96×48 sheet as a crosscut', () => {
    // The exact case from the handoff: one 95.9-long × 48-wide panel, no trim.
    // The vertical cut at x=95.9 frees the part to length — a CROSSCUT, not a
    // square-the-stock trim (there is no trim margin).
    const placements = [placement({ x: 0, y: 0, width: 95.9, height: 48 })];
    const { steps } = deriveCutSequenceFromPlacements(placements, 96, 48, { left: 0, top: 0, right: 0, bottom: 0 });

    const verticalCuts = steps.filter((s) => s.orientation === 'vertical');
    expect(verticalCuts.length).toBe(1);
    expect(verticalCuts[0].kind).toBe('crosscut');

    const described = describeCut(verticalCuts[0], 'imperial', 96, 48);
    expect(described.kind).toBe('crosscut');
    expect(described.label).not.toContain('Square the stock');
  });

  it('still labels a real square-the-stock cut as trim when a trim margin exists', () => {
    // 0.25" trim on the left → the first step must be a square-the-stock trim.
    const placements = [placement({ x: 0.25, y: 0, width: 40, height: 48 })];
    const { steps } = deriveCutSequenceFromPlacements(placements, 96, 48, { left: 0.25, top: 0, right: 0, bottom: 0 });

    expect(steps[0].kind).toBe('trim');
    const described = describeCut(steps[0], 'imperial', 96, 48);
    expect(described.kind).toBe('trim');
    expect(described.label).toContain('Square the stock');
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
