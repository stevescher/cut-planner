import { describe, it, expect, beforeEach, vi } from 'vitest';
import { solveAll } from '@/lib/optimizer/solver';
import { reOptimizeAroundPinned } from '@/lib/optimizer/reoptimize';
import { improveSolution } from '@/lib/optimizer/improve';
import { buildGroupBlocks, expandBlock } from '@/lib/optimizer/grain-groups';
import { suggestFixes } from '@/components/layout-viewer/LayoutViewer';
import { loadFromLocalStorage } from '@/lib/project-io';
import { useProjectStore } from '@/store/useProjectStore';
import { GrainGroup, Panel, Placement, Solution, StockSheet } from '@/lib/optimizer/types';

const KERF = 0.125;

function sheet(partial: Partial<StockSheet> = {}): StockSheet {
  return {
    id: 's1', label: 'Sheet', length: 96, width: 48, quantity: 10,
    trimTop: 0, trimRight: 0, trimBottom: 0, trimLeft: 0, grainDirection: 'length',
    ...partial,
  };
}

function panel(partial: Partial<Panel> & { id: string; length: number; width: number }): Panel {
  return { label: partial.id, quantity: 1, grain: 'follow', ...partial };
}

const bank: GrainGroup = { id: 'g1', name: 'Drawer bank', arrangement: 'stack' };

/** Drawer fronts for a 30"-wide cabinet: 6", 8", 10" tall, grain along the 30". */
const fronts = [
  panel({ id: 'top', length: 30, width: 6, grainGroup: 'g1' }),
  panel({ id: 'mid', length: 30, width: 8, grainGroup: 'g1' }),
  panel({ id: 'low', length: 30, width: 10, grainGroup: 'g1' }),
];

const groupParts = (s: Solution, id = 'g1') =>
  s.sheets.flatMap((sh, si) => sh.placements.filter((p) => p.group?.id === id).map((p) => ({ ...p, si })));

describe('buildGroupBlocks', () => {
  it('stacks parts across their width with a kerf between neighbours', () => {
    const [b] = buildGroupBlocks(fronts, [bank], KERF);
    expect(b.length).toBe(30);
    expect(b.width).toBeCloseTo(6 + 8 + 10 + 2 * KERF, 9);
    expect(b.members.map((m) => [m.seq, m.offsetL, m.offsetW])).toEqual([
      [1, 0, 0],
      [2, 0, 6 + KERF],
      [3, 0, 6 + 8 + 2 * KERF],
    ]);
  });

  it('lines parts up end to end for a row, repeating a panel by its quantity', () => {
    const row: GrainGroup = { ...bank, arrangement: 'row' };
    const parts = [panel({ id: 'a', length: 20, width: 15, quantity: 2, grainGroup: 'g1' })];
    const [b] = buildGroupBlocks(parts, [row], KERF);
    expect(b.length).toBeCloseTo(40 + KERF, 9);
    expect(b.width).toBe(15);
    expect(b.members.map((m) => m.offsetL)).toEqual([0, 20 + KERF]);
  });

  it('skips a group with no members', () => {
    expect(buildGroupBlocks(fronts, [{ ...bank, id: 'empty' }], KERF)).toEqual([]);
  });

  it('turns members onto the Y axis when the block is rotated, keeping their order', () => {
    const [b] = buildGroupBlocks(fronts, [bank], KERF);
    const ps = expandBlock(b, { x: 1, y: 2, rotated: true }, () => '#000');
    expect(ps.map((p) => [p.x, p.y, p.width, p.height, p.rotated])).toEqual([
      [1, 2, 6, 30, true],
      [1 + 6 + KERF, 2, 8, 30, true],
      [1 + 6 + 8 + 2 * KERF, 2, 10, 30, true],
    ]);
  });
});

describe('solveAll with a grain-matched group', () => {
  const others = [panel({ id: 'side', length: 34, width: 22, quantity: 4, grain: 'any' })];

  it('keeps the group on one sheet, in order, as one contiguous stack', () => {
    const [best] = solveAll({ stockSheets: [sheet()], panels: [...fronts, ...others], kerf: KERF, grainGroups: [bank] });
    expect(best.unplacedPanels).toHaveLength(0);
    const parts = groupParts(best);
    expect(parts.map((p) => p.panelId)).toEqual(['top', 'mid', 'low']);
    expect(new Set(parts.map((p) => p.si)).size).toBe(1);
    // Same left edge, each part starting one kerf below the previous one.
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].x).toBeCloseTo(parts[0].x, 6);
      expect(parts[i].y).toBeCloseTo(parts[i - 1].y + parts[i - 1].height + KERF, 6);
    }
  });

  it('rotates the whole group as a unit on a width-grain sheet', () => {
    const [best] = solveAll({
      stockSheets: [sheet({ grainDirection: 'width' })],
      panels: fronts, kerf: KERF, grainGroups: [bank],
    });
    const parts = groupParts(best);
    expect(parts.every((p) => p.rotated && p.height === 30)).toBe(true);
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].y).toBeCloseTo(parts[0].y, 6);
      expect(parts[i].x).toBeCloseTo(parts[i - 1].x + parts[i - 1].width + KERF, 6);
    }
  });

  it('leaves every member unplaced when the group cannot fit any sheet as one strip', () => {
    const tall = [
      panel({ id: 'a', length: 30, width: 30, grainGroup: 'g1' }),
      panel({ id: 'b', length: 30, width: 30, grainGroup: 'g1' }),
    ];
    // 30 + kerf + 30 across the grain exceeds the 48" sheet width, and grain
    // forbids turning the block, so the pair can't be cut as one strip.
    const [best] = solveAll({ stockSheets: [sheet({ length: 48, width: 48 })], panels: tall, kerf: KERF, grainGroups: [bank] });
    expect(best.unplacedPanels.map((p) => p.id).sort()).toEqual(['a', 'b']);
  });

  it('places grouped parts freely when the group is removed', () => {
    const [best] = solveAll({ stockSheets: [sheet()], panels: fronts, kerf: KERF, grainGroups: [] });
    expect(groupParts(best)).toHaveLength(0);
    expect(best.unplacedPanels).toHaveLength(0);
  });

  it('never splits a group across sheets, even when that would save one', () => {
    for (const qty of [1, 3, 5, 8]) {
      const solutions = solveAll({
        stockSheets: [sheet()],
        panels: [...fronts, panel({ id: 'x', length: 40, width: 20, quantity: qty, grain: 'any' })],
        kerf: KERF,
        grainGroups: [bank],
      });
      for (const s of solutions) {
        const parts = groupParts(s);
        if (parts.length > 0) expect(new Set(parts.map((p) => p.si)).size).toBe(1);
      }
    }
  });
});

describe('improveSolution never splits a group', () => {
  it('keeps a sheet holding a group even when its parts would fit elsewhere one by one', () => {
    const part = (id: string, x: number, y: number, w: number, h: number, seq?: number): Placement => ({
      panelId: id, label: id, x, y, width: w, height: h, rotated: false, pinned: false, color: '#000',
      ...(seq ? { group: { id: 'g1', seq } } : {}),
    });
    const layout = (sheetIndex: number, placements: Placement[]) => ({
      stockSheetId: 's1', sheetIndex, placements, cutSequence: [], wastePercent: 0,
      usedArea: placements.reduce((n, p) => n + p.width * p.height, 0),
    });
    // Sheet 0 holds only the group (720 sq in, the emptiest), sheet 1 one big
    // part with plenty of room: the parts would relocate individually.
    const solution: Solution = {
      id: 'base', strategyName: 't', totalWaste: 0, totalSheets: 2, unplacedPanels: [],
      sheets: [
        layout(0, [part('top', 0, 0, 30, 6, 1), part('mid', 0, 6.125, 30, 8, 2), part('low', 0, 14.25, 30, 10, 3)]),
        layout(1, [part('x', 0, 0, 40, 20)]),
      ],
    };
    const panels = [...fronts, panel({ id: 'x', length: 40, width: 20, grain: 'any' })];
    const improved = improveSolution(solution, [sheet()], panels, KERF);
    // Emptying the other sheet (moving 'x' beside the group) is fine; moving
    // the group's parts one by one is not. They must stay together, in place.
    const parts = groupParts(improved);
    expect(new Set(parts.map((p) => p.si)).size).toBe(1);
    expect(parts.map((p) => [p.panelId, p.x, p.y])).toEqual([
      ['top', 0, 0], ['mid', 0, 6.125], ['low', 0, 14.25],
    ]);
  });
});

describe('reOptimizeAroundPinned keeps a group rigid', () => {
  it('moves the group as one block without changing its parts\' spacing or order', () => {
    const [best] = solveAll({
      stockSheets: [sheet()],
      panels: [...fronts, panel({ id: 'side', length: 34, width: 22, quantity: 2, grain: 'any' })],
      kerf: KERF, grainGroups: [bank],
    });
    const sh = best.sheets[0];
    const sideIdx = sh.placements.findIndex((p) => p.panelId === 'side');
    const out = reOptimizeAroundPinned(best, [sheet()], new Set([`s1-0:${sideIdx}`]), KERF, [], 'auto');
    const before = sh.placements.filter((p) => p.group);
    const after = out.sheets[0].placements.filter((p) => p.group);
    const rel = (ps: Placement[]) => ps.map((p) => [p.panelId, p.x - ps[0].x, p.y - ps[0].y, p.rotated]);
    expect(rel(after)).toEqual(rel(before));
  });
});

describe('reOptimizeAroundPinned turns a group when grain requires it', () => {
  it('transposes an anchored group whose orientation the current sheet grain forbids', () => {
    // Planned on a length-grain sheet; the sheet is then switched to width grain.
    const [best] = solveAll({ stockSheets: [sheet()], panels: fronts, kerf: KERF, grainGroups: [bank] });
    const pins = new Set(best.sheets[0].placements.map((_, i) => `s1-0:${i}`));
    const out = reOptimizeAroundPinned(best, [sheet({ grainDirection: 'width' })], pins, KERF, fronts, 'auto');
    const parts = out.sheets[0].placements.filter((p) => p.group);
    expect(parts.map((p) => p.panelId)).toEqual(['top', 'mid', 'low']);
    expect(parts.every((p) => p.rotated && p.height === 30)).toBe(true);
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].y).toBeCloseTo(parts[0].y, 6);
      expect(parts[i].x).toBeCloseTo(parts[i - 1].x + parts[i - 1].width + KERF, 6);
    }
  });
});

describe('suggestFixes for an unplaced group', () => {
  it('lists the group once, sized as the whole block', () => {
    const solution: Solution = {
      id: 's', strategyName: 't', totalWaste: 0, totalSheets: 0, sheets: [],
      unplacedPanels: fronts,
    };
    const { suggestions, unfittable } = suggestFixes(solution, [sheet({ length: 20, width: 20 })], {
      panels: fronts, grainGroups: [bank], kerf: KERF,
    });
    expect(suggestions).toHaveLength(0);
    expect(unfittable).toHaveLength(1);
    expect(unfittable[0].label).toBe('Drawer bank (grain-matched group)');
    expect(unfittable[0].width).toBeCloseTo(24 + 2 * KERF, 9);
  });
});

describe('project file groups', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  const project = (extra: Record<string, unknown> = {}) => ({
    version: 2, name: 'P', savedAt: '2026-01-01T00:00:00Z', kerf: KERF, units: 'imperial',
    cutPreference: 'auto', stockSheets: [sheet()], panels: fronts, grainGroups: [bank], ...extra,
  });

  it('round-trips groups and memberships', () => {
    localStorage.setItem('cut-planner-project', JSON.stringify(project()));
    const loaded = loadFromLocalStorage()!;
    expect(loaded.grainGroups).toEqual([bank]);
    expect(loaded.panels.map((p) => p.grainGroup)).toEqual(['g1', 'g1', 'g1']);
  });

  it('drops a membership pointing at an undefined group', () => {
    localStorage.setItem('cut-planner-project', JSON.stringify(project({ grainGroups: [] })));
    expect(loadFromLocalStorage()!.panels.every((p) => p.grainGroup === undefined)).toBe(true);
  });

  it('rejects duplicate group ids', () => {
    localStorage.setItem('cut-planner-project', JSON.stringify(project({ grainGroups: [bank, { ...bank, name: 'Copy' }] })));
    expect(loadFromLocalStorage()).toBeNull();
  });

  it("normalizes a hand-edited group's members to the first member's grain", () => {
    const mixed = [fronts[0], { ...fronts[1], grain: 'across' }, { ...fronts[2], grain: 'any' }];
    localStorage.setItem('cut-planner-project', JSON.stringify(project({ panels: mixed })));
    expect(loadFromLocalStorage()!.panels.map((p) => p.grain)).toEqual(['follow', 'follow', 'follow']);
  });

  it('rejects a panel id in the reserved group namespace', () => {
    const clash = [...fronts, panel({ id: 'group:g1', length: 10, width: 10 })];
    localStorage.setItem('cut-planner-project', JSON.stringify(project({ panels: clash })));
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('rejects an unknown arrangement', () => {
    localStorage.setItem('cut-planner-project', JSON.stringify(project({ grainGroups: [{ ...bank, arrangement: 'diagonal' }] })));
    expect(loadFromLocalStorage()).toBeNull();
  });
});

describe('project store group actions', () => {
  beforeEach(() => {
    useProjectStore.setState({
      panels: [
        panel({ id: 'a', length: 30, width: 6, grain: 'across' }),
        panel({ id: 'b', length: 30, width: 8, grain: 'follow' }),
      ],
      grainGroups: [],
    });
  });

  it('a panel joining a group adopts the group\'s grain setting', () => {
    const s = useProjectStore.getState();
    const id = s.addGrainGroup('a');
    useProjectStore.getState().setPanelGroup('b', id);
    const b = useProjectStore.getState().panels.find((p) => p.id === 'b')!;
    expect(b.grainGroup).toBe(id);
    expect(b.grain).toBe('across');
  });

  it('a grain change on one member applies to the whole group', () => {
    const id = useProjectStore.getState().addGrainGroup('a');
    useProjectStore.getState().setPanelGroup('b', id);
    useProjectStore.getState().updatePanel('a', { grain: 'any' });
    expect(useProjectStore.getState().panels.map((p) => p.grain)).toEqual(['any', 'any']);
  });

  it('removing the last member removes the group', () => {
    useProjectStore.getState().addGrainGroup('a');
    useProjectStore.getState().removePanel('a');
    expect(useProjectStore.getState().grainGroups).toEqual([]);
  });

  it("creating a new group for an old group's only member removes the old group", () => {
    const first = useProjectStore.getState().addGrainGroup('a');
    const second = useProjectStore.getState().addGrainGroup('a');
    expect(useProjectStore.getState().grainGroups.map((g) => g.id)).toEqual([second]);
    expect(first).not.toBe(second);
  });

  it('names new groups Group A, Group B, ...', () => {
    useProjectStore.getState().addGrainGroup('a');
    useProjectStore.getState().addGrainGroup('b');
    expect(useProjectStore.getState().grainGroups.map((g) => g.name)).toEqual(['Group A', 'Group B']);
  });
});
