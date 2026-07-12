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
