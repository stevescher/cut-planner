import { PanelGrain, Placement, StockSheet } from './optimizer/types';

/** Which screen axis a grain runs along. 'x' = horizontal (sheet length), 'y' = vertical (sheet width). */
export type GrainAxis = 'x' | 'y';

/** Which placements of a panel are acceptable on a sheet: unrotated, rotated, or both. */
export interface Orientations {
  normal: boolean;
  rotated: boolean;
}

const BOTH: Orientations = { normal: true, rotated: true };

/** True when the sheet's material has a grain the layout must respect. */
export function sheetHasGrain(sheet: Pick<StockSheet, 'grainDirection'>): boolean {
  return sheet.grainDirection === 'length' || sheet.grainDirection === 'width';
}

/**
 * Grain axis of the stock sheet, or null for a grainless sheet. Grain along the
 * sheet's length runs on the X axis of the canvas, along its width on Y.
 */
export function sheetGrainAxis(sheet: Pick<StockSheet, 'grainDirection'>): GrainAxis | null {
  if (sheet.grainDirection === 'length') return 'x';
  if (sheet.grainDirection === 'width') return 'y';
  return null;
}

/**
 * Orientations a panel may take on a sheet.
 *
 * Convention: the solver places an unrotated piece with the panel's `length` on
 * the X axis (sheet length) and a rotated piece with it on Y. A 'follow' panel
 * wants its length parallel to the sheet grain, an 'across' panel its width.
 * A grainless sheet or an 'any' panel allows both orientations.
 */
export function allowedOrientations(
  panelGrain: PanelGrain,
  sheet: Pick<StockSheet, 'grainDirection'>,
): Orientations {
  const axis = sheetGrainAxis(sheet);
  if (axis === null || panelGrain === 'any') return BOTH;
  // The axis the panel's grain must lie on, expressed as "unrotated or not".
  const lengthOnGrain = panelGrain === 'follow';
  const unrotated = (axis === 'x') === lengthOnGrain;
  return { normal: unrotated, rotated: !unrotated };
}

/**
 * Orientations to try for one placement attempt in the solver. Grain rules come
 * first; a strategy's no-rotation flag only narrows a choice grain leaves open.
 */
export function solverOrientations(
  panelGrain: PanelGrain,
  sheet: Pick<StockSheet, 'grainDirection'>,
  strategyAllowsRotation: boolean,
): Orientations {
  const allowed = allowedOrientations(panelGrain, sheet);
  if (allowed.normal && allowed.rotated && !strategyAllowsRotation) {
    return { normal: true, rotated: false };
  }
  return allowed;
}

/** True when a placement sits in an orientation its panel's grain setting forbids on this sheet. */
export function isGrainViolation(
  placement: Pick<Placement, 'rotated'>,
  panelGrain: PanelGrain,
  sheet: Pick<StockSheet, 'grainDirection'>,
): boolean {
  const allowed = allowedOrientations(panelGrain, sheet);
  return placement.rotated ? !allowed.rotated : !allowed.normal;
}

/** True when rotating the placement 90 degrees would still satisfy the panel's grain setting. */
export function canRotatePlacement(
  placement: Pick<Placement, 'rotated'>,
  panelGrain: PanelGrain,
  sheet: Pick<StockSheet, 'grainDirection'>,
): boolean {
  const allowed = allowedOrientations(panelGrain, sheet);
  return placement.rotated ? allowed.normal : allowed.rotated;
}
