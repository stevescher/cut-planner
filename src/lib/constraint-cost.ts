import { CutPreference, GrainGroup, Panel, Solution, StockSheet } from './optimizer/types';
import { computeCost } from './cost';
import { sheetHasGrain } from './grain';

/** What one constraint costs: the best constrained plan versus the best plan without it. */
export interface ConstraintDelta {
  /** Extra sheets the constraint needs (0 when it costs no sheets). Never negative. */
  extraSheets: number;
  /** Extra material cost in dollars, or null when either plan uses an unpriced sheet. */
  extraCost: number | null;
  /** Parts the constrained plan leaves unplaced that the relaxed plan fits. */
  extraUnplaced: number;
}

export interface ConstraintCosts {
  grain?: ConstraintDelta;
  groups?: ConstraintDelta;
  cutOrder?: ConstraintDelta;
}

/**
 * True when grain actually constrains the job: some sheet has grain and some
 * panel's setting isn't "any orientation".
 */
export function grainIsActive(stockSheets: StockSheet[], panels: Panel[]): boolean {
  return stockSheets.some(sheetHasGrain) && panels.some((p) => p.grain !== 'any');
}

/** The same panels with grain released, for the relaxed comparison solve. */
export function relaxGrain(panels: Panel[]): Panel[] {
  return panels.map((p) => ({ ...p, grain: 'any' as const }));
}

/** True when some defined grain-matched group has a member panel. */
export function groupsAreActive(panels: Panel[], groups: GrainGroup[]): boolean {
  const ids = new Set(groups.map((g) => g.id));
  return panels.some((p) => p.grainGroup !== undefined && ids.has(p.grainGroup));
}

export function cutOrderIsActive(pref: CutPreference): boolean {
  return pref !== 'auto';
}

const unplacedCount = (s: Solution) => s.unplacedPanels.reduce((n, p) => n + p.quantity, 0);

/** Compare the best constrained plan with the best relaxed plan. */
export function constraintDelta(
  constrained: Solution,
  relaxed: Solution,
  stockSheets: StockSheet[],
): ConstraintDelta {
  const a = computeCost(constrained, stockSheets);
  const b = computeCost(relaxed, stockSheets);
  const fullyPriced = a.hasPricing && !a.hasUnpriced && b.hasPricing && !b.hasUnpriced;
  return {
    extraSheets: Math.max(0, constrained.totalSheets - relaxed.totalSheets),
    extraCost: fullyPriced ? Math.max(0, a.grandTotal - b.grandTotal) : null,
    extraUnplaced: Math.max(0, unplacedCount(constrained) - unplacedCount(relaxed)),
  };
}
