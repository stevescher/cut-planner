import { PackingStrategy, SortCriterion, SplitRule, SelectionRule } from './types';

const SORTS: SortCriterion[] = [
  'area-desc',
  'perimeter-desc',
  'longest-side-desc',
  'width-desc',
  'height-desc',
];

const SPLITS: SplitRule[] = [
  'shorter-axis',
  'longer-axis',
  'horizontal-first',
  'vertical-first',
];

const SELECTIONS: SelectionRule[] = [
  'best-short-side-fit',
  'best-long-side-fit',
  'best-area-fit',
  'worst-fit',
];

/** Generate a diverse set of packing strategies */
export function generateStrategies(): PackingStrategy[] {
  const strategies: PackingStrategy[] = [];

  // Core strategies: best combinations
  const coreCombinations: [SortCriterion, SplitRule, SelectionRule, boolean][] = [
    ['area-desc', 'shorter-axis', 'best-short-side-fit', true],
    ['area-desc', 'shorter-axis', 'best-area-fit', true],
    ['area-desc', 'longer-axis', 'best-long-side-fit', true],
    ['longest-side-desc', 'shorter-axis', 'best-short-side-fit', true],
    ['longest-side-desc', 'longer-axis', 'best-area-fit', true],
    ['perimeter-desc', 'shorter-axis', 'best-short-side-fit', true],
    ['perimeter-desc', 'longer-axis', 'worst-fit', true],
    ['width-desc', 'horizontal-first', 'best-short-side-fit', true],
    ['height-desc', 'vertical-first', 'best-short-side-fit', true],
    // No-rotation variants
    ['area-desc', 'shorter-axis', 'best-short-side-fit', false],
    ['area-desc', 'shorter-axis', 'best-area-fit', false],
    ['longest-side-desc', 'shorter-axis', 'best-short-side-fit', false],
    ['perimeter-desc', 'shorter-axis', 'best-area-fit', false],
    ['width-desc', 'vertical-first', 'best-area-fit', true],
    ['height-desc', 'horizontal-first', 'best-area-fit', true],
  ];

  for (const [sort, split, selection, rotation] of coreCombinations) {
    strategies.push({
      name: `${sort}/${split}/${selection}${rotation ? '' : '/no-rot'}`,
      sort,
      splitRule: split,
      selectionRule: selection,
      allowRotation: rotation,
    });
  }

  return strategies;
}

/** Sort panels by the given criterion. Returns a new array (does not mutate). */
export function sortPanels(
  panels: { length: number; width: number; index: number }[],
  criterion: SortCriterion
): { length: number; width: number; index: number }[] {
  const sorted = [...panels];
  sorted.sort((a, b) => {
    switch (criterion) {
      case 'area-desc':
        return b.length * b.width - a.length * a.width;
      case 'perimeter-desc':
        return 2 * (b.length + b.width) - 2 * (a.length + a.width);
      case 'longest-side-desc':
        return Math.max(b.length, b.width) - Math.max(a.length, a.width);
      case 'width-desc':
        return b.width - a.width;
      case 'height-desc':
        return b.length - a.length;
    }
  });
  return sorted;
}

export { SORTS, SPLITS, SELECTIONS };
