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
      const seg = { x1: node.x, y1: child2.y, x2: node.x + node.width, y2: child2.y };
      steps.push({
        stepNumber: stepNum++,
        orientation: 'horizontal',
        ...seg,
        segments: [seg],
      });
    } else {
      const seg = { x1: child2.x, y1: node.y, x2: child2.x, y2: node.y + node.height };
      steps.push({
        stepNumber: stepNum++,
        orientation: 'vertical',
        ...seg,
        segments: [seg],
      });
    }

    // Recurse into children
    traverse(child1);
    traverse(child2);
  }

  traverse(root);
  return steps;
}
