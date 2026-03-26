import {
  GuillotineNode,
  Placement,
  SplitRule,
  SelectionRule,
} from './types';

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

/** Score a free rectangle for a given piece size (lower is better, -1 = doesn't fit) */
function scoreFit(
  freeW: number,
  freeH: number,
  pieceW: number,
  pieceH: number,
  rule: SelectionRule
): number {
  if (freeW < pieceW || freeH < pieceH) return -1;

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
 * @param pieceW - width of piece including kerf
 * @param pieceH - height of piece including kerf
 * @param actualW - actual width (without kerf, for the placement record)
 * @param actualH - actual height (without kerf, for the placement record)
 */
export function placeInTree(
  tree: GuillotineNode,
  pieceW: number,
  pieceH: number,
  actualW: number,
  actualH: number,
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
  let bestAW = actualW;
  let bestAH = actualH;

  for (const rect of freeRects) {
    // Try normal orientation
    const score = scoreFit(rect.width, rect.height, pieceW, pieceH, selectionRule);
    if (score !== -1 && score < bestScore) {
      bestScore = score;
      bestNode = rect.node;
      bestRotated = false;
      bestPW = pieceW;
      bestPH = pieceH;
      bestAW = actualW;
      bestAH = actualH;
    }

    // Try rotated
    if (allowRotation && pieceW !== pieceH) {
      const scoreR = scoreFit(rect.width, rect.height, pieceH, pieceW, selectionRule);
      if (scoreR !== -1 && scoreR < bestScore) {
        bestScore = scoreR;
        bestNode = rect.node;
        bestRotated = true;
        bestPW = pieceH;
        bestPH = pieceW;
        bestAW = actualH;
        bestAH = actualW;
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

  // Split the node
  const placement: Placement = {
    panelId: placementInfo.panelId,
    label: placementInfo.label,
    x: bestNode.x,
    y: bestNode.y,
    width: bestAW,
    height: bestAH,
    rotated: bestRotated,
    pinned: false,
    color: placementInfo.color,
  };

  if (splitDir === 'horizontal') {
    // Split horizontally: piece goes top-left
    // Right child: to the right of the piece, same height as piece
    // Bottom child: below the piece, full width
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

    // We need to split this into: the placed piece + right remainder + bottom remainder
    // Using a two-level split for guillotine correctness:
    // First split: horizontal at piece bottom → top strip + bottom strip
    // Second split: vertical at piece right in top strip

    const topRight: GuillotineNode = {
      x: bestNode.x + bestPW,
      y: bestNode.y,
      width: bestNode.width - bestPW,
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
      y: bestNode.y + bestPH,
      width: bestNode.width,
      height: bestNode.height - bestPH,
      split: null,
      placement: null,
      children: null,
    };

    bestNode.children = [topStrip, bottomStrip];
  } else {
    // Split vertically: piece goes top-left
    // Bottom child: below piece, same width as piece
    // Right child: to the right, full height

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
      y: bestNode.y + bestPH,
      width: bestPW,
      height: bestNode.height - bestPH,
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
      x: bestNode.x + bestPW,
      y: bestNode.y,
      width: bestNode.width - bestPW,
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
