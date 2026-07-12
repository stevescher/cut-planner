import { describe, it, expect } from 'vitest';
import { solveAll } from '@/lib/optimizer/solver';
import { reOptimizeAroundPinned } from '@/lib/optimizer/reoptimize';
import { StockSheet, Panel, Solution } from '@/lib/optimizer/types';

/** Build a stock sheet with sane defaults (no trim). */
function sheet(partial: Partial<StockSheet> & { length: number; width: number }): StockSheet {
  return {
    id: partial.id ?? 's1',
    label: partial.label ?? 'Sheet',
    length: partial.length,
    width: partial.width,
    quantity: partial.quantity ?? 1,
    trimTop: partial.trimTop ?? 0,
    trimRight: partial.trimRight ?? 0,
    trimBottom: partial.trimBottom ?? 0,
    trimLeft: partial.trimLeft ?? 0,
  };
}

function panel(partial: Partial<Panel> & { length: number; width: number }): Panel {
  return {
    id: partial.id ?? 'p1',
    label: partial.label ?? 'Panel',
    length: partial.length,
    width: partial.width,
    quantity: partial.quantity ?? 1,
    lockRotation: partial.lockRotation ?? false,
  };
}

/** Best (first) solution from the ranked list. */
function best(config: Parameters<typeof solveAll>[0]) {
  const solutions = solveAll(config);
  expect(solutions.length).toBeGreaterThan(0);
  return solutions[0];
}

describe('kerf edge accounting (CRITICAL #1 regression)', () => {
  it('places a part whose dimension exactly equals the sheet dimension, even with kerf', () => {
    // A single 48×48 part on a 48-wide sheet must fit — kerf is not charged
    // against the sheet boundary.
    const s = best({
      stockSheets: [sheet({ length: 96, width: 48 })],
      panels: [panel({ length: 48, width: 48, quantity: 1 })],
      kerf: 0.125,
    });
    expect(s.unplacedPanels).toHaveLength(0);
    expect(s.totalSheets).toBe(1);
  });

  it('places both exact-width halves (48+48) rather than dropping them', () => {
    // Before the kerf-edge fix, EACH 48-wide part was rejected outright
    // (48 + 0.125 > 48 on the width axis) and the app reported "couldn't fit,
    // needs 2 more sheets" for a layout that should be trivial. Now both place.
    // Note: two full 48s + one internal kerf = 96.125 > 96, so a real saw needs
    // two boards — that's physically correct, not the old spurious rejection.
    const s = best({
      stockSheets: [sheet({ length: 96, width: 48, quantity: 4 })],
      panels: [panel({ length: 48, width: 48, quantity: 2 })],
      kerf: 0.125,
    });
    expect(s.unplacedPanels).toHaveLength(0);
  });

  it('fits two halves on one sheet when the kerf actually has room (47.9 each)', () => {
    // 47.9375 + 0.125 + 47.9375 = 96 exactly — one kerf between two slightly
    // under-half parts fits a single 96 sheet.
    const s = best({
      stockSheets: [sheet({ length: 96, width: 48, quantity: 4 })],
      panels: [panel({ length: 47.9375, width: 48, quantity: 2 })],
      kerf: 0.125,
    });
    expect(s.unplacedPanels).toHaveLength(0);
    expect(s.totalSheets).toBe(1);
  });

  it('does charge kerf between adjacent pieces (three 32-wide on 96 fails with kerf)', () => {
    // 32+32+32 == 96 exactly, but two internal kerfs push it over → cannot fit
    // all three on one 96 sheet.
    const s = best({
      stockSheets: [sheet({ length: 96, width: 48, quantity: 1 })],
      panels: [panel({ length: 32, width: 48, quantity: 3 })],
      kerf: 0.125,
    });
    const placed = 3 - s.unplacedPanels.reduce((n, p) => n + p.quantity, 0);
    // Only two can share the sheet (32 + kerf + 32 = 64.125 ≤ 96, third needs
    // another 32 + kerf = 96.25 > 96).
    expect(placed).toBe(2);
  });

  it('opens a sheet for an exact metric fit despite float drift (mm ÷ 25.4)', () => {
    // 2440mm stock, 1mm left trim, 2439mm panel. In inches the usable length and
    // the panel length differ only by ~1e-14 of float drift — the strict-> sheet
    // admission gate would refuse to open a sheet and report the part unplaced.
    const mm = (v: number) => v / 25.4;
    const s = best({
      stockSheets: [
        sheet({ length: mm(2440), width: mm(1220), trimLeft: mm(1) }),
      ],
      panels: [panel({ length: mm(2439), width: mm(600), quantity: 1 })],
      kerf: mm(3),
    });
    expect(s.unplacedPanels).toHaveLength(0);
    expect(s.totalSheets).toBe(1);
  });

  it('does not overlap placements', () => {
    const s = best({
      stockSheets: [sheet({ length: 96, width: 48, quantity: 2 })],
      panels: [
        panel({ id: 'a', length: 24, width: 24, quantity: 4 }),
        panel({ id: 'b', length: 30, width: 12, quantity: 3 }),
      ],
      kerf: 0.125,
    });
    for (const sh of s.sheets) {
      const ps = sh.placements;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i];
          const b = ps[j];
          const overlap =
            a.x < b.x + b.width - 1e-6 &&
            a.x + a.width > b.x + 1e-6 &&
            a.y < b.y + b.height - 1e-6 &&
            a.y + a.height > b.y + 1e-6;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it('keeps every placement inside its sheet bounds', () => {
    const stock = sheet({ length: 96, width: 48, quantity: 3 });
    const s = best({
      stockSheets: [stock],
      panels: [panel({ length: 20, width: 15, quantity: 10 })],
      kerf: 0.1,
    });
    for (const sh of s.sheets) {
      for (const p of sh.placements) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-6);
        expect(p.y).toBeGreaterThanOrEqual(-1e-6);
        expect(p.x + p.width).toBeLessThanOrEqual(stock.length + 1e-6);
        expect(p.y + p.height).toBeLessThanOrEqual(stock.width + 1e-6);
      }
    }
  });
});

describe('trim / square-the-stock cuts', () => {
  it('emits square-the-stock cuts before part cuts when the sheet has trim', () => {
    const s = best({
      stockSheets: [
        sheet({ length: 96, width: 48, trimLeft: 1, trimTop: 1, trimRight: 1, trimBottom: 1 }),
      ],
      panels: [panel({ length: 20, width: 15, quantity: 4 })],
      kerf: 0.125,
    });
    const sheetLayout = s.sheets[0];
    // Trim cuts land on the usable-region boundaries (x=1, x=95, y=1, y=47).
    const cutXs = sheetLayout.cutSequence
      .filter((c) => c.orientation === 'vertical')
      .map((c) => c.x1);
    const cutYs = sheetLayout.cutSequence
      .filter((c) => c.orientation === 'horizontal')
      .map((c) => c.y1);
    expect(cutXs).toContain(1);
    expect(cutXs).toContain(95);
    expect(cutYs).toContain(1);
    expect(cutYs).toContain(47);
    // Every placement sits inside the usable box.
    for (const p of sheetLayout.placements) {
      expect(p.x).toBeGreaterThanOrEqual(1 - 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(1 - 1e-6);
      expect(p.x + p.width).toBeLessThanOrEqual(95 + 1e-6);
      expect(p.y + p.height).toBeLessThanOrEqual(47 + 1e-6);
    }
  });

  it('still emits trim cuts when the trim margin equals the kerf (1/8" trim, 1/8" kerf)', () => {
    const s = best({
      stockSheets: [
        sheet({ length: 96, width: 48, trimLeft: 0.125, trimRight: 0.125, trimTop: 0.125, trimBottom: 0.125 }),
      ],
      panels: [panel({ length: 20, width: 15, quantity: 4 })],
      kerf: 0.125,
    });
    const cuts = s.sheets[0].cutSequence;
    // The four square-the-stock cuts must still be present at the usable edges.
    expect(cuts.some((c) => c.orientation === 'vertical' && Math.abs(c.x1 - 0.125) < 1e-6)).toBe(true);
    expect(cuts.some((c) => c.orientation === 'vertical' && Math.abs(c.x1 - 95.875) < 1e-6)).toBe(true);
    expect(cuts.some((c) => c.orientation === 'horizontal' && Math.abs(c.y1 - 0.125) < 1e-6)).toBe(true);
    expect(cuts.some((c) => c.orientation === 'horizontal' && Math.abs(c.y1 - 47.875) < 1e-6)).toBe(true);
  });

  it('emits a cut for a single panel whose offcut is smaller than the kerf', () => {
    // 95.9" part on a 96" sheet, 1/8" kerf. Waste (0.1") < blade width, but the
    // stock must still be cut down to 95.9" — the vertical cut must appear.
    const s = best({
      stockSheets: [sheet({ length: 96, width: 48 })],
      panels: [panel({ length: 95.9, width: 48, quantity: 1 })],
      kerf: 0.125,
    });
    const cuts = s.sheets[0].cutSequence;
    expect(cuts.some((c) => c.orientation === 'vertical' && Math.abs(c.x1 - 95.9) < 1e-6)).toBe(true);
  });

  it('emits no trim cuts on a zero-trim sheet', () => {
    const s = best({
      stockSheets: [sheet({ length: 96, width: 48 })],
      panels: [panel({ length: 20, width: 15, quantity: 3 })],
      kerf: 0.125,
    });
    // With no trim, no cut should sit on the raw sheet edges (0 or full dim).
    for (const c of s.sheets[0].cutSequence) {
      expect(c.x1 === 0 && c.x2 === 0).toBe(false);
    }
  });
});

describe('edge cases', () => {
  it('reports a panel larger than every sheet as unplaced (no crash)', () => {
    const s = best({
      stockSheets: [sheet({ length: 48, width: 48 })],
      panels: [panel({ length: 100, width: 100, quantity: 1 })],
      kerf: 0.125,
    });
    expect(s.unplacedPanels.reduce((n, p) => n + p.quantity, 0)).toBe(1);
  });

  it('ignores zero-size panels', () => {
    const s = best({
      stockSheets: [sheet({ length: 48, width: 48 })],
      panels: [panel({ length: 0, width: 10, quantity: 2 })],
      kerf: 0.125,
    });
    expect(s.sheets.flatMap((sh) => sh.placements)).toHaveLength(0);
  });

  it('handles empty panel input', () => {
    const solutions = solveAll({
      stockSheets: [sheet({ length: 48, width: 48 })],
      panels: [],
      kerf: 0.125,
    });
    // No panels → a solution with zero used sheets.
    expect(solutions[0].sheets.every((sh) => sh.placements.length === 0)).toBe(true);
  });

  it('respects lockRotation (grain lock) — a locked tall part is never laid down', () => {
    // 40×10 locked; on a 96×48 sheet it must stay 40 long (x) × 10 wide (y).
    const s = best({
      stockSheets: [sheet({ length: 96, width: 48 })],
      panels: [panel({ length: 40, width: 10, quantity: 1, lockRotation: true })],
      kerf: 0.125,
    });
    const p = s.sheets.flatMap((sh) => sh.placements)[0];
    expect(p.rotated).toBe(false);
    expect(p.width).toBeCloseTo(40, 6);
    expect(p.height).toBeCloseTo(10, 6);
  });
});

describe('reOptimizeAroundPinned kerf clearance', () => {
  it('keeps a kerf gap between a pinned piece and re-packed neighbours', () => {
    const kerf = 0.125;
    // Two 10-wide parts that could tile a 20-wide sheet edge-to-edge. One is
    // pinned; the other is re-packed. They must not end up flush (0 gap).
    const solution: Solution = {
      id: 'sol',
      strategyName: 'test',
      totalWaste: 0,
      totalSheets: 1,
      unplacedPanels: [],
      sheets: [
        {
          stockSheetId: 's1',
          sheetIndex: 0,
          wastePercent: 0,
          usedArea: 0,
          cutSequence: [],
          placements: [
            { panelId: 'a', label: 'A', x: 10, y: 0, width: 10, height: 48, rotated: false, pinned: true, color: '#111' },
            { panelId: 'b', label: 'B', x: 0, y: 0, width: 10, height: 48, rotated: false, pinned: false, color: '#222' },
          ],
        },
      ],
    };
    const stock: StockSheet = sheet({ id: 's1', length: 20, width: 48 });
    const out = reOptimizeAroundPinned(solution, [stock], new Set(['s1-0:0']), kerf, []);
    const ps = out.sheets[0].placements;
    // Any two horizontally-adjacent parts must be separated by at least the kerf.
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const yOverlap = a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
        if (!yOverlap) continue;
        const gap = a.x < b.x ? b.x - (a.x + a.width) : a.x - (b.x + b.width);
        expect(gap).toBeGreaterThanOrEqual(kerf - 1e-6);
      }
    }
  });
});

describe('reOptimizeAroundPinned respects lockRotation (OPUS-401)', () => {
  // A sheet only tall in Y and narrow in X: an unrotated 40(x)×10(y) part does
  // NOT fit (needs 40 of X, only 12 available), but a rotated 10(x)×40(y) part
  // DOES. Without a lock guard the re-optimizer would rotate the locked part to
  // place it; with the guard it must refuse and leave it unplaced instead.
  const narrowTallStock: StockSheet = sheet({ id: 's1', length: 12, width: 48 });

  function lockedSolution(pinned: boolean): Solution {
    return {
      id: 'sol',
      strategyName: 'test',
      totalWaste: 0,
      totalSheets: 1,
      unplacedPanels: [],
      sheets: [
        {
          stockSheetId: 's1',
          sheetIndex: 0,
          wastePercent: 0,
          usedArea: 0,
          cutSequence: [],
          // Placed unrotated (40 long in x, 10 in y) — but that can't actually
          // fit the 12-wide sheet; the point is the re-plan must not "fix" it by
          // rotating a locked part.
          placements: [
            { panelId: 'locked', label: 'L', x: 0, y: 0, width: 40, height: 10, rotated: false, pinned, color: '#111' },
          ],
        },
      ],
    };
  }

  const lockedPanels: Panel[] = [
    panel({ id: 'locked', length: 40, width: 10, lockRotation: true }),
  ];

  it('does not rotate a locked anchored (pinned) panel to make it fit', () => {
    const out = reOptimizeAroundPinned(lockedSolution(true), [narrowTallStock], new Set(['s1-0:0']), 0.125, lockedPanels);
    const placed = out.sheets[0].placements.filter((p) => p.panelId === 'locked');
    // It must NOT appear rotated. Either it stays unrotated, or it isn't placed
    // at all — but it is never flipped to 10×40.
    for (const p of placed) {
      expect(p.rotated).toBe(false);
      expect(p.width).toBeCloseTo(40, 6);
    }
  });

  it('does not rotate a locked floating (unpinned) panel to make it fit', () => {
    const out = reOptimizeAroundPinned(lockedSolution(false), [narrowTallStock], new Set<string>(), 0.125, lockedPanels);
    const placed = out.sheets[0].placements.filter((p) => p.panelId === 'locked');
    for (const p of placed) {
      expect(p.rotated).toBe(false);
      expect(p.width).toBeCloseTo(40, 6);
    }
  });

  it('still rotates an UNLOCKED panel when that is the only way to place it', () => {
    const unlockedPanels: Panel[] = [
      panel({ id: 'locked', length: 40, width: 10, lockRotation: false }),
    ];
    const out = reOptimizeAroundPinned(lockedSolution(false), [narrowTallStock], new Set<string>(), 0.125, unlockedPanels);
    const placed = out.sheets[0].placements.filter((p) => p.panelId === 'locked');
    // Unlocked: the re-optimizer is free to rotate it to fit the tall/narrow sheet.
    expect(placed).toHaveLength(1);
    expect(placed[0].rotated).toBe(true);
    expect(placed[0].width).toBeCloseTo(10, 6);
    expect(placed[0].height).toBeCloseTo(40, 6);
  });
});
