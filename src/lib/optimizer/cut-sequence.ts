import { GuillotineNode, CutStep } from './types';

/**
 * Derive the cut sequence from a guillotine tree.
 * The tree naturally encodes the order: each split node = one saw cut.
 * We traverse depth-first, numbering cuts in order.
 */
export function deriveCutSequence(root: GuillotineNode): CutStep[] {
  const steps: CutStep[] = [];
  let stepNum = 1;

  function traverse(node: GuillotineNode): void {
    if (!node.children || !node.split) return;

    const [child1, child2] = node.children;

    if (node.split === 'horizontal') {
      // Horizontal split at the boundary between child1 and child2
      // The cut line is horizontal at y = child2.y, spanning the full width of node
      steps.push({
        stepNumber: stepNum++,
        orientation: 'horizontal',
        x1: node.x,
        y1: child2.y,
        x2: node.x + node.width,
        y2: child2.y,
      });
    } else {
      // Vertical split at x = child2.x, spanning the full height of node
      steps.push({
        stepNumber: stepNum++,
        orientation: 'vertical',
        x1: child2.x,
        y1: node.y,
        x2: child2.x,
        y2: node.y + node.height,
      });
    }

    // Recurse into children
    traverse(child1);
    traverse(child2);
  }

  traverse(root);
  return steps;
}
