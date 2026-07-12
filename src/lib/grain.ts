import { Placement, StockSheet } from './optimizer/types';

/** Which screen axis a grain runs along. 'x' = horizontal (sheet length), 'y' = vertical (sheet width). */
export type GrainAxis = 'x' | 'y';

/**
 * Grain axis of the stock sheet. Grain runs along the sheet's length by default
 * (length is the X axis on the canvas), or along the width when configured.
 */
export function sheetGrainAxis(sheet: StockSheet): GrainAxis {
  return sheet.grainDirection === 'width' ? 'y' : 'x';
}

/**
 * Grain axis of a placed piece.
 *
 * Convention: a panel's grain runs along its `length`. The solver places an
 * unrotated piece with its length on the X axis (`placement.width = panel.length`)
 * and a rotated piece with its length on the Y axis. So an unrotated piece's
 * grain runs along X, a rotated piece's along Y.
 */
export function pieceGrainAxis(placement: Placement): GrainAxis {
  return placement.rotated ? 'y' : 'x';
}

/**
 * True when a placed piece's grain runs perpendicular to the sheet grain.
 * Geometric only — does not consider whether the user can act on it.
 */
export function isGrainCrossed(placement: Placement, sheet: StockSheet): boolean {
  return pieceGrainAxis(placement) !== sheetGrainAxis(sheet);
}

/**
 * Whether to flag a piece as a grain mismatch in the UI.
 *
 * Only flag when the piece is cross-grain AND the user can actually fix it by
 * rotating — i.e. the panel is NOT rotation-locked. A rotation-locked panel's
 * orientation is fixed by design (the rotate control is disabled), so on a
 * width-grain sheet it may sit cross-grain with no way to realign; flagging it
 * would be a false alarm the user cannot clear. The lock is the user's explicit
 * grain decision, so we trust it and stay silent.
 */
export function isGrainMismatch(
  placement: Placement,
  sheet: StockSheet,
  rotationLocked: boolean,
): boolean {
  return !rotationLocked && isGrainCrossed(placement, sheet);
}
