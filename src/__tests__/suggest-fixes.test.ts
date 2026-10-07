import { describe, it, expect } from 'vitest';
import { suggestFixes } from '@/components/layout-viewer/LayoutViewer';
import { Panel, StockSheet, Solution } from '@/lib/optimizer/types';

// suggestFixes classifies each unplaced panel as either fixable-by-adding-sheets
// (a SheetSuggestion) or unfittable. For a panel whose grain fixes its
// orientation it must NOT count the forbidden orientation as a fit, or an
// add-sheets fix would leave it unplaced. (OPUS-405)

function panel(p: Partial<Panel> & { length: number; width: number }): Panel {
  return {
    id: p.id ?? 'p1',
    label: p.label ?? 'Panel',
    length: p.length,
    width: p.width,
    quantity: p.quantity ?? 1, // in unplacedPanels this is the unplaced count
    grain: p.grain ?? 'any',
  };
}

function stock(s: Partial<StockSheet> & { length: number; width: number }): StockSheet {
  return {
    id: s.id ?? 's1',
    label: s.label ?? 'Sheet',
    length: s.length,
    width: s.width,
    quantity: s.quantity ?? 1,
    trimTop: s.trimTop ?? 0,
    trimRight: s.trimRight ?? 0,
    trimBottom: s.trimBottom ?? 0,
    trimLeft: s.trimLeft ?? 0,
    grainDirection: s.grainDirection ?? 'length',
  };
}

function solutionWithUnplaced(unplaced: Panel[]): Solution {
  return {
    id: 'sol',
    strategyName: 'test',
    totalWaste: 0,
    totalSheets: 0,
    unplacedPanels: unplaced,
    sheets: [],
  };
}

describe('suggestFixes respects panel grain (OPUS-405)', () => {
  // Panel 30(len) x 40(wid). Sheet usable 45 x 35: fits ONLY rotated
  // (40<=45 && 30<=35), never in its given orientation (30<=45 but 40>35).
  const tallSheet = stock({ length: 45, width: 35 });

  it('classifies a follow-grain panel that only fits rotated as unfittable', () => {
    const locked = panel({ length: 30, width: 40, grain: 'follow' });
    const { suggestions, unfittable } = suggestFixes(solutionWithUnplaced([locked]), [tallSheet]);
    expect(suggestions).toHaveLength(0);
    expect(unfittable.map((p) => p.id)).toContain('p1');
  });

  it('still offers an add-sheets fix for an any-orientation panel that only fits rotated', () => {
    const unlocked = panel({ length: 30, width: 40, grain: 'any' });
    const { suggestions, unfittable } = suggestFixes(solutionWithUnplaced([unlocked]), [tallSheet]);
    expect(unfittable).toHaveLength(0);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].sheet.id).toBe('s1');
  });

  it('offers an add-sheets fix for a follow-grain panel that fits in its given orientation', () => {
    // Follow-grain 30x40 on a roomy 96x48 sheet fits unrotated: a legitimate fix.
    const locked = panel({ length: 30, width: 40, grain: 'follow' });
    const roomy = stock({ length: 96, width: 48 });
    const { suggestions, unfittable } = suggestFixes(solutionWithUnplaced([locked]), [roomy]);
    expect(unfittable).toHaveLength(0);
    expect(suggestions).toHaveLength(1);
  });
});
