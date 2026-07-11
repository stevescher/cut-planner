import { describe, it, expect } from 'vitest';
import { solveAll } from '@/lib/optimizer/solver';
import { StockSheet, Panel } from '@/lib/optimizer/types';

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
