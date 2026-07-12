import { describe, it, expect } from 'vitest';
import { solveAll } from '@/lib/optimizer/solver';
import {
  improveSolution,
  scoreSolution,
  compareScores,
  bestOf,
} from '@/lib/optimizer/improve';
import { Solution, SheetLayout, StockSheet, Panel, Placement } from '@/lib/optimizer/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function stock(overrides: Partial<StockSheet> = {}): StockSheet {
  return {
    id: overrides.id ?? 's1',
    label: '',
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

function panel(overrides: Partial<Panel> = {}): Panel {
  return {
    id: overrides.id ?? 'p1',
    label: overrides.label ?? 'A',
    length: 24,
    width: 12,
    quantity: 1,
    lockRotation: false,
    ...overrides,
  };
}

/** Overlap check on a single sheet's placements (kerf ignored — strict overlap). */
function hasOverlap(placements: Placement[]): boolean {
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      const overlap =
        a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;
      if (overlap) return true;
    }
  }
  return false;
}

function countPieces(sol: Solution): number {
  return sol.sheets.reduce((n, s) => n + s.placements.length, 0);
}

// ── Score helpers ─────────────────────────────────────────────────────────────

describe('compareScores / bestOf', () => {
  const base = { unplaced: 0, totalSheets: 2, orientationPenalty: 0, wasteBucket: 40, totalCuts: 5, exactWaste: 40 };

  it('ranks fewer sheets first', () => {
    expect(compareScores({ ...base, totalSheets: 1 }, base)).toBeLessThan(0);
  });

  it('ranks fewer unplaced before fewer sheets', () => {
    // a has more sheets but 0 unplaced; b has 1 unplaced — a wins.
    const a = { ...base, unplaced: 0, totalSheets: 3 };
    const b = { ...base, unplaced: 1, totalSheets: 1 };
    expect(compareScores(a, b)).toBeLessThan(0);
  });

  it('bestOf keeps the incumbent on a tie', () => {
    const s1 = { sheets: [], totalSheets: 2, totalWaste: 40, unplacedPanels: [] } as unknown as Solution;
    const s2 = { sheets: [], totalSheets: 2, totalWaste: 40, unplacedPanels: [] } as unknown as Solution;
    expect(bestOf(s1, s2)).toBe(s1);
  });
});

// ── Improvement never regresses (property over real solver output) ────────────

describe('improveSolution never ranks worse than the greedy baseline', () => {
  const cases: Array<{ name: string; sheets: StockSheet[]; panels: Panel[] }> = [
    {
      name: 'many small parts',
      sheets: [stock()],
      panels: [panel({ id: 'a', length: 24, width: 12, quantity: 12 })],
    },
    {
      name: 'mixed sizes',
      sheets: [stock()],
      panels: [
        panel({ id: 'a', length: 40, width: 20, quantity: 4 }),
        panel({ id: 'b', length: 18, width: 10, quantity: 8 }),
      ],
    },
    {
      name: 'two stock types',
      sheets: [stock({ id: 's1' }), stock({ id: 's2', length: 48, width: 48 })],
      panels: [panel({ id: 'a', length: 22, width: 22, quantity: 6 })],
    },
    {
      name: 'rotation-locked parts',
      sheets: [stock()],
      panels: [panel({ id: 'a', length: 30, width: 10, quantity: 8, lockRotation: true })],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const solutions = solveAll({ stockSheets: c.sheets, panels: c.panels, kerf: 0.125 });
      expect(solutions.length).toBeGreaterThan(0);
      const baseline = solutions[0];
      const improved = improveSolution(baseline, c.sheets, c.panels, 0.125);

      // Never worse on the ranking objective.
      expect(compareScores(scoreSolution(improved), scoreSolution(baseline))).toBeLessThanOrEqual(0);
      // Never uses more sheets.
      expect(improved.totalSheets).toBeLessThanOrEqual(baseline.totalSheets);
      // Never drops a placed piece.
      expect(countPieces(improved)).toBe(countPieces(baseline));
      // No overlaps introduced on any sheet.
      for (const sheet of improved.sheets) {
        expect(hasOverlap(sheet.placements)).toBe(false);
      }
    });
  }
});

// ── Sheet elimination on a crafted over-split solution ────────────────────────

/**
 * Build a two-sheet solution where every piece would comfortably fit on ONE
 * 96×48 sheet (four 24×12 parts = 1152 in² out of 4608 in² usable). A greedy
 * sweep can strand them across two sheets; the improvement pass must collapse
 * them back to one.
 */
function twoSheetSolution(): { solution: Solution; sheets: StockSheet[]; panels: Panel[] } {
  const sheets = [stock({ id: 's1' })];
  const panels = [panel({ id: 'a', length: 24, width: 12, quantity: 4 })];

  const mk = (sheetIndex: number, n: number): SheetLayout => {
    const placements: Placement[] = Array.from({ length: n }, (_, k) => ({
      panelId: 'a',
      label: 'A',
      x: 0,
      y: k * 13, // stacked with a gap, comfortably inside 48 height
      width: 24,
      height: 12,
      rotated: false,
      pinned: false,
      color: '#123456',
    }));
    const usedArea = placements.reduce((s, p) => s + p.width * p.height, 0);
    return {
      stockSheetId: 's1',
      sheetIndex,
      placements,
      cutSequence: [{ stepNumber: 1, orientation: 'horizontal', x1: 0, y1: 0, x2: 24, y2: 0, segments: [] }],
      wastePercent: 0,
      usedArea,
    };
  };

  // Two sheets, 2 pieces each — all four fit easily on one sheet.
  const solution: Solution = {
    id: 'greedy',
    strategyName: 'test',
    sheets: [mk(0, 2), mk(1, 2)],
    totalWaste: 0,
    totalSheets: 2,
    unplacedPanels: [],
  };
  return { solution, sheets, panels };
}

describe('sheet-elimination relocate', () => {
  it('collapses an over-split two-sheet layout into one sheet', () => {
    const { solution, sheets, panels } = twoSheetSolution();
    const improved = improveSolution(solution, sheets, panels, 0.125);

    expect(improved.totalSheets).toBe(1);
    // All four pieces preserved.
    expect(countPieces(improved)).toBe(4);
    // No overlaps.
    expect(hasOverlap(improved.sheets[0].placements)).toBe(false);
    // Strictly better than the two-sheet baseline.
    expect(compareScores(scoreSolution(improved), scoreSolution(solution))).toBeLessThan(0);
  });

  it('leaves an already-optimal single-sheet layout unchanged in sheet count', () => {
    const { sheets, panels } = twoSheetSolution();
    const single: Solution = {
      id: 'single',
      strategyName: 'test',
      sheets: [twoSheetSolution().solution.sheets[0]],
      totalWaste: 0,
      totalSheets: 1,
      unplacedPanels: [],
    };
    const improved = improveSolution(single, sheets, panels, 0.125);
    expect(improved.totalSheets).toBe(1);
  });
});

// ── OPUS-399: kerf must not be charged against the sheet boundary ──────────────

/**
 * Two 47.9375 × 48 halves exactly fill a 96 × 48 sheet with a single 0.125 kerf
 * between them (47.9375 + 0.125 + 47.9375 = 96). Each half is full-height (48),
 * flush to the top and bottom sheet edges. A correct fit check charges kerf only
 * between parts, so relocating the second half into the free strip beside the
 * first must succeed and collapse the layout to one sheet.
 *
 * The pre-fix `tryPlace` required `height + kerf <= rect.h` — 48 + 0.125 > 48 —
 * so it rejected the flush placement and left two sheets.
 */
function boundaryFlushTwoSheet(): { solution: Solution; sheets: StockSheet[]; panels: Panel[] } {
  const sheets = [stock({ id: 's1', length: 96, width: 48 })];
  const panels = [panel({ id: 'h', label: 'Half', length: 47.9375, width: 48, quantity: 2 })];

  const half = (): Placement => ({
    panelId: 'h', label: 'Half',
    x: 0, y: 0, width: 47.9375, height: 48,
    rotated: false, pinned: false, color: '#334455',
  });

  const mk = (sheetIndex: number): SheetLayout => {
    const placements = [half()];
    return {
      stockSheetId: 's1', sheetIndex, placements,
      cutSequence: [], wastePercent: 50, usedArea: 47.9375 * 48,
    };
  };

  const solution: Solution = {
    id: 'greedy', strategyName: 'test',
    sheets: [mk(0), mk(1)],
    totalWaste: 50, totalSheets: 2, unplacedPanels: [],
  };
  return { solution, sheets, panels };
}

describe('sheet-elimination respects sheet boundaries (OPUS-399)', () => {
  it('collapses two boundary-flush halves onto one sheet (kerf only between parts)', () => {
    const { solution, sheets, panels } = boundaryFlushTwoSheet();
    const improved = improveSolution(solution, sheets, panels, 0.125);

    // Both halves fit on one 96×48 sheet with a single kerf between them.
    expect(improved.totalSheets).toBe(1);
    expect(countPieces(improved)).toBe(2);
    expect(hasOverlap(improved.sheets[0].placements)).toBe(false);
    // Every placed piece stays inside the usable sheet bounds.
    for (const p of improved.sheets[0].placements) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(96 + 1e-6);
      expect(p.y + p.height).toBeLessThanOrEqual(48 + 1e-6);
    }
  });
});

// ── OPUS-398: never promote a non-guillotine (approximate) relocation ──────────

/**
 * A pinwheel arrangement: four interlocking 30×10 / 10×30 arms that tile a 40×40
 * square only in a NON-guillotine layout — no single straight edge-to-edge cut
 * separates them, so `deriveCutSequenceFromPlacements` returns an approximate
 * sequence (a cut line would pass through a part).
 *
 * Arms (rotation-locked so the relocation can't re-orient into a clean tiling):
 *   a  (0,0)  30×10   — top
 *   b  (30,0) 10×30   — right
 *   c  (10,30) 30×10  — bottom
 *   d  (0,10) 10×30   — left   ← the interlocking arm
 *
 * Baseline: two sheets, three arms on the first, the fourth (d) alone on the
 * second. Relocating d into the pinwheel notch on the first sheet empties the
 * second — but the combined layout is non-guillotine, so the pass must NOT
 * promote it. kerf=0 keeps the notch exactly d-sized so the geometry is exact.
 */
function pinwheelTwoSheet(): { solution: Solution; sheets: StockSheet[]; panels: Panel[] } {
  const sheets = [stock({ id: 's1', length: 40, width: 40 })];
  const panels = [
    panel({ id: 'a', label: 'a', length: 30, width: 10, quantity: 1, lockRotation: true }),
    panel({ id: 'b', label: 'b', length: 10, width: 30, quantity: 1, lockRotation: true }),
    panel({ id: 'c', label: 'c', length: 30, width: 10, quantity: 1, lockRotation: true }),
    panel({ id: 'd', label: 'd', length: 10, width: 30, quantity: 1, lockRotation: true }),
  ];
  const p = (id: string, x: number, y: number, w: number, h: number): Placement => ({
    panelId: id, label: id, x, y, width: w, height: h,
    rotated: false, pinned: false, color: '#884422',
  });

  const s0: SheetLayout = {
    stockSheetId: 's1', sheetIndex: 0,
    placements: [p('a', 0, 0, 30, 10), p('b', 30, 0, 10, 30), p('c', 10, 30, 30, 10)],
    cutSequence: [], wastePercent: 0, usedArea: 900,
  };
  const s1: SheetLayout = {
    stockSheetId: 's1', sheetIndex: 1,
    placements: [p('d', 0, 0, 10, 30)],
    cutSequence: [], wastePercent: 0, usedArea: 300,
  };
  const solution: Solution = {
    id: 'greedy', strategyName: 'test',
    sheets: [s0, s1], totalWaste: 0, totalSheets: 2, unplacedPanels: [],
  };
  return { solution, sheets, panels };
}

describe('sheet-elimination never promotes an approximate cut sequence (OPUS-398)', () => {
  it('does not eliminate a sheet when the only single-sheet fit is non-guillotine', () => {
    const { solution, sheets, panels } = pinwheelTwoSheet();
    // kerf=0 makes the pinwheel notch exactly d-sized so the relocation is
    // geometrically possible — the ONLY thing that should stop it is the
    // approximate-cut guard.
    const improved = improveSolution(solution, sheets, panels, 0);

    // No surviving sheet may carry an approximate cut sequence — a promoted
    // approximate layout would show cuts passing through parts.
    for (const sheet of improved.sheets) {
      expect(sheet.cutSequenceApproximate ?? false).toBe(false);
    }
    // The guard rejects the pinwheel collapse, so the two-sheet (guillotine-valid)
    // baseline is preserved rather than replaced by a 1-sheet approximate layout.
    expect(improved.totalSheets).toBe(2);
    // No piece is dropped.
    expect(countPieces(improved)).toBe(4);
  });
});
