import {
  GuillotineNode,
  Placement,
  SplitRule,
  SelectionRule,
} from './types';

/**
 * Tolerance for fit comparisons (inches). Absorbs floating-point drift from
 * metric conversions (mm ÷ 25.4) so an exact-fit part isn't rejected by a
 * sub-thousandth-inch rounding error. Exported so the sheet-admission gate in
 * the solver applies the identical tolerance the tree placement uses.
 */
export const FIT_EPS = 1e-6;

/** Create a fresh guillotine tree for a sheet with given usable dimensions */
export function createTree(width: number, height: number): GuillotineNode {
  return {
    x: 0,
    y: 0,
    width,
    height,
    split: null,
    placement: null,
    children: null,
  };
}

interface FreeRect {
  node: GuillotineNode;
  width: number;
  height: number;
  x: number;
  y: number;
}

/** Collect all free (leaf, unoccupied) rectangles in the tree */
function collectFreeRects(node: GuillotineNode): FreeRect[] {
  if (node.children) {
    return [
      ...collectFreeRects(node.children[0]),
      ...collectFreeRects(node.children[1]),
    ];
  }
  if (!node.placement && node.width > 0 && node.height > 0) {
    return [{ node, width: node.width, height: node.height, x: node.x, y: node.y }];
  }
  return [];
}

/**
 * Score a free rectangle for a given piece size (lower is better, -1 = doesn't fit).
 * pieceW/pieceH are the RAW piece dimensions (without kerf). A piece fits when its
 * raw size fits the free rect — kerf is only consumed between adjacent pieces
 * (handled at split time), never against the sheet/free-rect boundary.
 */
function scoreFit(
  freeW: number,
  freeH: number,
  pieceW: number,
  pieceH: number,
  rule: SelectionRule
): number {
  if (freeW < pieceW - FIT_EPS || freeH < pieceH - FIT_EPS) return -1;

  const leftoverW = freeW - pieceW;
  const leftoverH = freeH - pieceH;

  switch (rule) {
    case 'best-short-side-fit':
      return Math.min(leftoverW, leftoverH);
    case 'best-long-side-fit':
      return Math.max(leftoverW, leftoverH);
    case 'best-area-fit':
      return leftoverW * leftoverH;
    case 'worst-fit':
      return -(leftoverW * leftoverH);
  }
}

/** Determine split direction based on the split rule and remaining space */
function chooseSplit(
  freeW: number,
  freeH: number,
  pieceW: number,
  pieceH: number,
  rule: SplitRule
): 'horizontal' | 'vertical' {
  const remainW = freeW - pieceW;
  const remainH = freeH - pieceH;

  switch (rule) {
    case 'shorter-axis':
      return remainW < remainH ? 'vertical' : 'horizontal';
    case 'longer-axis':
      return remainW >= remainH ? 'vertical' : 'horizontal';
    case 'horizontal-first':
      return 'horizontal';
    case 'vertical-first':
      return 'vertical';
  }
}

/**
 * Try to place a piece into the guillotine tree.
 * Returns the placement coordinates if successful, or null.
 *
 * Kerf (saw blade width) is material lost *between* two cuts. It is charged only
 * on the remainder side of a split — i.e. the neighbour region starts `kerf` past
 * the piece edge — and never against the sheet boundary. When the remaining space
 * on a side is ≤ kerf there is no room for a neighbouring piece there, so no kerf
 * is consumed and the region collapses to zero.
 *
 * @param pieceW - raw width of the piece (without kerf)
 * @param pieceH - raw height of the piece (without kerf)
 * @param kerf   - saw blade width, reserved only between adjacent pieces
 */
export function placeInTree(
  tree: GuillotineNode,
  pieceW: number,
  pieceH: number,
  kerf: number,
  selectionRule: SelectionRule,
  splitRule: SplitRule,
  allowRotation: boolean,
  placementInfo: { panelId: string; label: string; color: string }
): Placement | null {
  const freeRects = collectFreeRects(tree);

  let bestNode: GuillotineNode | null = null;
  let bestScore = Infinity;
  let bestRotated = false;
  let bestPW = pieceW;
  let bestPH = pieceH;

  for (const rect of freeRects) {
    // Try normal orientation
    const score = scoreFit(rect.width, rect.height, pieceW, pieceH, selectionRule);
    if (score !== -1 && score < bestScore) {
      bestScore = score;
      bestNode = rect.node;
      bestRotated = false;
      bestPW = pieceW;
      bestPH = pieceH;
    }

    // Try rotated
    if (allowRotation && Math.abs(pieceW - pieceH) > FIT_EPS) {
      const scoreR = scoreFit(rect.width, rect.height, pieceH, pieceW, selectionRule);
      if (scoreR !== -1 && scoreR < bestScore) {
        bestScore = scoreR;
        bestNode = rect.node;
        bestRotated = true;
        bestPW = pieceH;
        bestPH = pieceW;
      }
    }
  }

  if (!bestNode) return null;

  const splitDir = chooseSplit(
    bestNode.width,
    bestNode.height,
    bestPW,
    bestPH,
    splitRule
  );

  const placement: Placement = {
    panelId: placementInfo.panelId,
    label: placementInfo.label,
    x: bestNode.x,
    y: bestNode.y,
    width: bestPW,
    height: bestPH,
    rotated: bestRotated,
    pinned: false,
    color: placementInfo.color,
  };

  // Remaining space on each axis after the piece. A neighbour only exists (and a
  // kerf is only consumed) when the remainder exceeds the kerf itself; otherwise
  // the piece runs to the boundary and the region collapses to zero width/height.
  const remainW = bestNode.width - bestPW;
  const remainH = bestNode.height - bestPH;
  const rightW = remainW > kerf + FIT_EPS ? remainW - kerf : 0;
  const bottomH = remainH > kerf + FIT_EPS ? remainH - kerf : 0;
  // Offset of the neighbour region = piece + kerf, but clamped so a piece flush
  // against the boundary (no room for a kerf) sits at the piece edge.
  const rightOffset = rightW > 0 ? bestPW + kerf : bestPW;
  const bottomOffset = bottomH > 0 ? bestPH + kerf : bestPH;

  if (splitDir === 'horizontal') {
    // Split horizontally: piece top-left, right remainder same height as piece,
    // bottom remainder full width.
    bestNode.split = 'horizontal';
    bestNode.placement = null;

    const topLeft: GuillotineNode = {
      x: bestNode.x,
      y: bestNode.y,
      width: bestPW,
      height: bestPH,
      split: null,
      placement,
      children: null,
    };

    const topRight: GuillotineNode = {
      x: bestNode.x + rightOffset,
      y: bestNode.y,
      width: rightW,
      height: bestPH,
      split: null,
      placement: null,
      children: null,
    };

    const topStrip: GuillotineNode = {
      x: bestNode.x,
      y: bestNode.y,
      width: bestNode.width,
      height: bestPH,
      split: 'vertical',
      placement: null,
      children: [topLeft, topRight],
    };

    const bottomStrip: GuillotineNode = {
      x: bestNode.x,
      y: bestNode.y + bottomOffset,
      width: bestNode.width,
      height: bottomH,
      split: null,
      placement: null,
      children: null,
    };

    bestNode.children = [topStrip, bottomStrip];
  } else {
    // Split vertically: piece top-left, bottom remainder same width as piece,
    // right remainder full height.
    const topLeft: GuillotineNode = {
      x: bestNode.x,
      y: bestNode.y,
      width: bestPW,
      height: bestPH,
      split: null,
      placement,
      children: null,
    };

    const bottomLeft: GuillotineNode = {
      x: bestNode.x,
      y: bestNode.y + bottomOffset,
      width: bestPW,
      height: bottomH,
      split: null,
      placement: null,
      children: null,
    };

    const leftStrip: GuillotineNode = {
      x: bestNode.x,
      y: bestNode.y,
      width: bestPW,
      height: bestNode.height,
      split: 'horizontal',
      placement: null,
      children: [topLeft, bottomLeft],
    };

    const rightStrip: GuillotineNode = {
      x: bestNode.x + rightOffset,
      y: bestNode.y,
      width: rightW,
      height: bestNode.height,
      split: null,
      placement: null,
      children: null,
    };

    bestNode.children = [leftStrip, rightStrip];
    bestNode.split = 'vertical';
  }

  return placement;
}

/** Collect all placements from the tree */
export function collectPlacements(node: GuillotineNode): Placement[] {
  if (node.placement) return [node.placement];
  if (node.children) {
    return [
      ...collectPlacements(node.children[0]),
      ...collectPlacements(node.children[1]),
    ];
  }
  return [];
}
