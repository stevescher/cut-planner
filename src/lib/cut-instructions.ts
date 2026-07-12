import { CutStep, SheetLayout } from '@/lib/optimizer/types';
import { formatDisplay, unitSuffix, Units } from '@/lib/fractions';

/**
 * Human-readable cut instructions derived from the optimizer's `cutSequence`.
 *
 * The optimizer stores cuts as geometry (`orientation` + coordinates); a
 * woodworker at the saw needs "rip to 24 inches" not "horizontal cut at y=24".
 * This module is the single place that translates the two, so the print view
 * and any future export share one wording and one measurement convention.
 *
 * ── Coordinate → cut-type convention ─────────────────────────────────────────
 * The sheet's x-axis runs along its LENGTH, the y-axis along its WIDTH (see the
 * dimension labels in SheetCanvas: the x label is `stockSheet.length`).
 *
 *   • orientation 'horizontal' — a cut at constant y, spanning the length.
 *     It runs ALONG the length axis, setting a piece's WIDTH → this is a RIP.
 *     Measurement = distance from the top edge (the cut's y position).
 *
 *   • orientation 'vertical' — a cut at constant x, spanning the width.
 *     It runs ACROSS the length, setting a piece's LENGTH → this is a CROSSCUT.
 *     Measurement = distance from the left edge (the cut's x position).
 *
 * Trim ("square the stock") cuts span the full raw sheet and are surfaced
 * separately so the printed list starts by squaring the board.
 */

export type CutKind = 'trim' | 'rip' | 'crosscut';

export interface CutInstruction {
  stepNumber: number;
  kind: CutKind;
  /** Full imperative line, e.g. `Rip to 24"` or `Crosscut to 30"`. */
  label: string;
  /** The measured distance from the reference edge, formatted with unit suffix. */
  measurement: string;
  /** Which edge the measurement is taken from. */
  fromEdge: 'left' | 'top';
  /** True when the underlying cut is a best-effort approximation (may pass through a piece). */
  approximate: boolean;
}

/** A trim cut spans the full raw sheet on its constant axis. We treat a step as
 *  "square the stock" when it is flagged during derivation by running edge-to-edge
 *  of the sheet rather than within the usable region. Since `CutStep` doesn't carry
 *  a kind, we detect trims by the caller passing the raw sheet bounds. */
function isTrimCut(step: CutStep, sheetLength: number, sheetWidth: number): boolean {
  const EPS = 1e-3;
  if (step.orientation === 'vertical') {
    // Vertical trim spans the full sheet height (0 → sheetWidth).
    return Math.abs(step.y1 - 0) < EPS && Math.abs(step.y2 - sheetWidth) < EPS;
  }
  // Horizontal trim spans the full sheet width (0 → sheetLength).
  return Math.abs(step.x1 - 0) < EPS && Math.abs(step.x2 - sheetLength) < EPS;
}

/**
 * Translate one raw `CutStep` into a shop instruction.
 *
 * `sheetLength`/`sheetWidth` are the RAW stock dimensions — needed to tell a
 * square-the-stock trim cut (spans the whole board) from a rip/crosscut that
 * lives inside the usable area.
 */
export function describeCut(
  step: CutStep,
  units: Units,
  sheetLength: number,
  sheetWidth: number,
): CutInstruction {
  const suffix = unitSuffix(units);
  const approximate = step.approximate ?? false;
  const trim = isTrimCut(step, sheetLength, sheetWidth);

  // Measurement position: vertical cut → x (from left); horizontal cut → y (from top).
  const position = step.orientation === 'vertical' ? step.x1 : step.y1;
  const measurement = `${formatDisplay(position, units)}${suffix}`;
  const fromEdge: 'left' | 'top' = step.orientation === 'vertical' ? 'left' : 'top';

  let kind: CutKind;
  let label: string;
  if (trim) {
    kind = 'trim';
    label = `Square the stock — trim ${step.orientation === 'vertical' ? 'edge' : 'end'} to ${measurement} from ${fromEdge}`;
  } else if (step.orientation === 'horizontal') {
    kind = 'rip';
    label = `Rip to ${measurement}`;
  } else {
    kind = 'crosscut';
    label = `Crosscut to ${measurement}`;
  }

  return { stepNumber: step.stepNumber, kind, label, measurement, fromEdge, approximate };
}

/**
 * Build the full ordered instruction list for one sheet. Steps are already
 * numbered and ordered (trim cuts first) by `deriveCutSequenceFromPlacements`;
 * this preserves that order and just translates each to shop wording.
 */
export function describeSheetCuts(
  sheet: SheetLayout,
  units: Units,
  sheetLength: number,
  sheetWidth: number,
): CutInstruction[] {
  return sheet.cutSequence.map((step) => describeCut(step, units, sheetLength, sheetWidth));
}
