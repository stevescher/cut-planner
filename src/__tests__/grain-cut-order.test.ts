import { describe, it, expect } from 'vitest';
import { solveAll } from '@/lib/optimizer/solver';
import { compareScores, SolutionScore } from '@/lib/optimizer/improve';
import { deriveCutSequenceFromPlacements } from '@/lib/optimizer/reoptimize';
import { sheetAllowsFirstCut, evaluateCutOrder } from '@/lib/optimizer/cut-order';
import { constraintDelta, grainIsActive, relaxGrain } from '@/lib/constraint-cost';
import { CutPreference, Panel, Placement, Solution, StockSheet } from '@/lib/optimizer/types';

function sheet(partial: Partial<StockSheet> = {}): StockSheet {
  return {
    id: 's1',
    label: 'Sheet',
    length: 96,
    width: 48,
    quantity: 10,
    trimTop: 0,
    trimRight: 0,
    trimBottom: 0,
    trimLeft: 0,
    grainDirection: 'none',
    ...partial,
  };
}

function panel(partial: Partial<Panel> & { length: number; width: number }): Panel {
  return { id: 'p1', label: 'Panel', quantity: 1, grain: 'follow', ...partial };
}

function piece(x: number, y: number, width: number, height: number): Placement {
  return { panelId: 'p', label: 'p', x, y, width, height, rotated: false, pinned: false, color: '#000' };
}

const allPlacements = (s: Solution) => s.sheets.flatMap((sh) => sh.placements);

describe('solver honors sheet grain', () => {
  it('rotates a follow-grain part on a width-grain sheet so its length runs with the grain', () => {
    const [best] = solveAll({
      stockSheets: [sheet({ grainDirection: 'width' })],
      panels: [panel({ length: 40, width: 10, quantity: 3 })],
      kerf: 0.125,
    });
    expect(best.unplacedPanels).toHaveLength(0);
    for (const p of allPlacements(best)) {
      expect(p.rotated).toBe(true);
      expect(p.height).toBeCloseTo(40, 6); // length along Y, the grain axis
    }
  });

  it('places an across-grain part with its width along a length-grain sheet', () => {
    const [best] = solveAll({
      stockSheets: [sheet({ grainDirection: 'length' })],
      panels: [panel({ length: 40, width: 10, grain: 'across' })],
      kerf: 0.125,
    });
    const [p] = allPlacements(best);
    expect(p.rotated).toBe(true);
    expect(p.width).toBeCloseTo(10, 6);
  });

  it('records a square follow-grain part as rotated on a width-grain sheet', () => {
    const [best] = solveAll({
      stockSheets: [sheet({ grainDirection: 'width' })],
      panels: [panel({ length: 20, width: 20 })],
      kerf: 0.125,
    });
    expect(allPlacements(best)[0].rotated).toBe(true);
  });

  it('lets a follow-grain part rotate freely on a grainless sheet', () => {
    // 40 x 30 only fits a 32-long x 48-wide sheet when turned.
    const [best] = solveAll({
      stockSheets: [sheet({ length: 32, width: 48, grainDirection: 'none' })],
      panels: [panel({ length: 40, width: 30 })],
      kerf: 0.125,
    });
    expect(best.unplacedPanels).toHaveLength(0);
    expect(allPlacements(best)[0].rotated).toBe(true);
  });

  it('applies grain per sheet type when stock types differ', () => {
    const [best] = solveAll({
      stockSheets: [
        sheet({ id: 'w', length: 48, width: 48, quantity: 1, grainDirection: 'width' }),
        sheet({ id: 'l', length: 96, width: 48, quantity: 1, grainDirection: 'length' }),
      ],
      panels: [panel({ length: 40, width: 10, quantity: 6 })],
      kerf: 0.125,
    });
    for (const sh of best.sheets) {
      const expectRotated = sh.stockSheetId === 'w';
      for (const p of sh.placements) expect(p.rotated).toBe(expectRotated);
    }
  });
});

describe('sheetAllowsFirstCut', () => {
  const stock = sheet();

  it('accepts rip-first when a full-length horizontal cut is clean', () => {
    const ps = [piece(0, 0, 40, 20), piece(40.125, 0, 40, 20)];
    expect(sheetAllowsFirstCut(ps, stock, 'horizontal')).toBe(true);
  });

  it('rejects rip-first when a full-height part blocks every horizontal cut', () => {
    const ps = [piece(0, 0, 48, 48), piece(48.125, 0, 24, 20)];
    expect(sheetAllowsFirstCut(ps, stock, 'horizontal')).toBe(false);
    expect(sheetAllowsFirstCut(ps, stock, 'vertical')).toBe(true);
  });

  it('accepts either direction when no cut is needed', () => {
    const ps = [piece(0, 0, 96, 48)];
    expect(sheetAllowsFirstCut(ps, stock, 'horizontal')).toBe(true);
    expect(sheetAllowsFirstCut(ps, stock, 'vertical')).toBe(true);
  });

  it('evaluateCutOrder is undefined for auto', () => {
    expect(evaluateCutOrder([], [stock], 'auto')).toBeUndefined();
  });
});

describe('solveAll with a cut preference', () => {
  const job = {
    stockSheets: [sheet()],
    panels: [
      panel({ id: 'a', length: 40, width: 20, quantity: 3, grain: 'any' }),
      panel({ id: 'b', length: 30, width: 14, quantity: 3, grain: 'any' }),
    ],
    kerf: 0.125,
  };

  const firstPieceCut = (s: Solution) =>
    s.sheets[0].cutSequence.find((c) => c.kind !== 'trim')?.orientation;

  it.each<[CutPreference, 'horizontal' | 'vertical']>([
    ['always-rip', 'horizontal'],
    ['always-crosscut', 'vertical'],
  ])('%s: every layout returned starts each sheet with that cut', (pref, axis) => {
    const solutions = solveAll({ ...job, cutPreference: pref });
    expect(solutions.length).toBeGreaterThan(0);
    for (const sol of solutions) {
      expect(sol.cutOrder).toEqual({ preference: pref, mismatchedSheets: 0 });
      for (const sh of sol.sheets) {
        expect(sheetAllowsFirstCut(sh.placements, job.stockSheets[0], axis)).toBe(true);
      }
    }
    expect(firstPieceCut(solutions[0])).toBe(axis);
  });

  it('favor-* never uses more sheets than auto', () => {
    const auto = solveAll({ ...job, cutPreference: 'auto' })[0];
    for (const pref of ['favor-rip', 'favor-crosscut'] as const) {
      expect(solveAll({ ...job, cutPreference: pref })[0].totalSheets).toBeLessThanOrEqual(auto.totalSheets);
    }
  });

  it('reports mismatched sheets when no layout can start with a rip', () => {
    // A 48 x 48 part fills the sheet height, so every layout must crosscut first.
    const [best] = solveAll({
      stockSheets: [sheet({ quantity: 1 })],
      panels: [panel({ id: 'sq', length: 48, width: 48, grain: 'any' }), panel({ id: 'c', length: 30, width: 20, grain: 'any' })],
      kerf: 0.125,
      cutPreference: 'always-rip',
    });
    expect(best.unplacedPanels).toHaveLength(0);
    expect(best.cutOrder?.mismatchedSheets).toBe(1);
  });
});

describe('cut-order ranking', () => {
  const base: SolutionScore = {
    unplaced: 0, hardCutOrder: 0, totalSheets: 2, softCutOrder: 0,
    orientationPenalty: 0, wasteBucket: 40, totalCuts: 5, exactWaste: 40,
  };

  it('an always-* mismatch outranks sheet count', () => {
    expect(compareScores({ ...base, totalSheets: 3 }, { ...base, hardCutOrder: 1 })).toBeLessThan(0);
  });

  it('a favor-* mismatch never outranks sheet count', () => {
    expect(compareScores({ ...base, totalSheets: 1, softCutOrder: 1 }, base)).toBeLessThan(0);
    expect(compareScores(base, { ...base, softCutOrder: 1 })).toBeLessThan(0);
  });
});

describe('deriveCutSequenceFromPlacements firstCut', () => {
  const trim = { left: 0.5, top: 0.5, right: 0.5, bottom: 0.5 };
  // Two parts side by side in one strip: both a horizontal waste cut and a
  // vertical separating cut are clean at the top level.
  const ps = [piece(0.5, 0.5, 40, 20), piece(40.625, 0.5, 40, 20)];

  it('puts horizontal trims and a rip first for rip-first', () => {
    const { steps } = deriveCutSequenceFromPlacements(ps, 96, 48, trim, { firstCut: 'horizontal' });
    expect(steps.slice(0, 2).every((s) => s.kind === 'trim' && s.orientation === 'horizontal')).toBe(true);
    expect(steps.find((s) => s.kind !== 'trim')?.orientation).toBe('horizontal');
  });

  it('keeps vertical trims and a crosscut first for crosscut-first', () => {
    const { steps } = deriveCutSequenceFromPlacements(ps, 96, 48, trim, { firstCut: 'vertical' });
    expect(steps[0].orientation).toBe('vertical');
    expect(steps.find((s) => s.kind !== 'trim')?.orientation).toBe('vertical');
  });

  it('orders a single part rip before crosscut for rip-first', () => {
    const { steps } = deriveCutSequenceFromPlacements([piece(0, 0, 40, 20)], 96, 48, undefined, { firstCut: 'horizontal' });
    expect(steps.map((s) => s.kind)).toEqual(['rip', 'crosscut']);
  });
});

describe('constraint cost', () => {
  const sol = (sheets: number, stockSheetId = 's1', unplaced: Panel[] = []): Solution => ({
    id: String(sheets),
    strategyName: 't',
    totalWaste: 0,
    totalSheets: sheets,
    unplacedPanels: unplaced,
    sheets: Array.from({ length: sheets }, (_, i) => ({
      stockSheetId, sheetIndex: i, placements: [], cutSequence: [], wastePercent: 0, usedArea: 0,
    })),
  });

  it('reports extra sheets and dollars when every sheet is priced', () => {
    const priced = [sheet({ pricePerSheet: 68 })];
    expect(constraintDelta(sol(3), sol(2), priced)).toEqual({ extraSheets: 1, extraCost: 68, extraUnplaced: 0 });
  });

  it('reports no dollar figure when a sheet is unpriced', () => {
    expect(constraintDelta(sol(3), sol(2), [sheet()]).extraCost).toBeNull();
  });

  it('counts parts that only fit without the constraint', () => {
    const p = panel({ length: 10, width: 10, quantity: 2 });
    expect(constraintDelta(sol(1, 's1', [p]), sol(1), [sheet()]).extraUnplaced).toBe(2);
  });

  it('grain is active only with a grained sheet and a constrained part', () => {
    const parts = [panel({ length: 10, width: 5 })];
    expect(grainIsActive([sheet({ grainDirection: 'none' })], parts)).toBe(false);
    expect(grainIsActive([sheet({ grainDirection: 'length' })], parts)).toBe(true);
    expect(grainIsActive([sheet({ grainDirection: 'length' })], relaxGrain(parts))).toBe(false);
  });
});
