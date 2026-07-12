import { nanoid } from 'nanoid';
import {
  StockSheet,
  Panel,
  Solution,
  SheetLayout,
  PackingStrategy,
  GuillotineNode,
} from './types';
import { createTree, placeInTree, collectPlacements, FIT_EPS } from './guillotine';
import { deriveCutSequenceFromPlacements } from './reoptimize';
import { generateStrategies, sortPanels } from './strategies';
import { getColor } from '../colors';

interface ExpandedPanel {
  panelId: string;
  label: string;
  length: number;
  width: number;
  originalIndex: number;
  lockRotation: boolean;
}

interface OpenSheet {
  stockSheet: StockSheet;
  sheetIndex: number;
  tree: GuillotineNode;
  usableLength: number;
  usableWidth: number;
}

/** Expand panels by quantity into individual items */
function expandPanels(panels: Panel[]): ExpandedPanel[] {
  const expanded: ExpandedPanel[] = [];
  panels.forEach((panel, idx) => {
    for (let q = 0; q < panel.quantity; q++) {
      expanded.push({
        panelId: panel.id,
        label: panel.label || `Panel ${idx + 1}`,
        length: panel.length,
        width: panel.width,
        originalIndex: idx,
        lockRotation: panel.lockRotation,
      });
    }
  });
  return expanded;
}

/** Get usable dimensions of a stock sheet after trim */
function getUsableDimensions(sheet: StockSheet): { length: number; width: number } {
  return {
    length: Math.max(0, sheet.length - sheet.trimLeft - sheet.trimRight),
    width: Math.max(0, sheet.width - sheet.trimTop - sheet.trimBottom),
  };
}

/** Run a single strategy and produce a Solution */
function solveWithStrategy(
  stockSheets: StockSheet[],
  panels: Panel[],
  kerf: number,
  strategy: PackingStrategy
): Solution {
  const expanded = expandPanels(panels.filter((p) => p.length > 0 && p.width > 0));

  // Sort panels according to strategy
  const sortable = expanded.map((p, i) => ({
    length: p.length,
    width: p.width,
    index: i,
  }));
  const sorted = sortPanels(sortable, strategy.sort);

  // Track open sheets and how many of each stock sheet type we've used
  const openSheets: OpenSheet[] = [];
  const sheetUsage = new Map<string, number>();
  const unplacedCounts = new Map<string, number>();

  // Sort stock sheets by area (largest first) for sheet selection
  const availableSheets = [...stockSheets]
    .filter((s) => s.length > 0 && s.width > 0)
    .sort((a, b) => a.length * a.width - b.length * b.width); // smallest first to minimize waste

  function openNewSheet(minLength: number, minWidth: number, canRotate: boolean): OpenSheet | null {
    // Find the smallest stock sheet that can fit the piece
    for (const ss of availableSheets) {
      const usable = getUsableDimensions(ss);
      const currentUsage = sheetUsage.get(ss.id) || 0;
      if (currentUsage >= ss.quantity) continue;

      // Use the same tolerance the tree placement uses, so a piece the tree
      // would accept (e.g. an exact metric fit off by float drift) also opens
      // a sheet instead of being reported unplaced.
      const fits =
        (usable.length >= minLength - FIT_EPS && usable.width >= minWidth - FIT_EPS) ||
        (canRotate &&
          usable.length >= minWidth - FIT_EPS &&
          usable.width >= minLength - FIT_EPS);

      if (fits) {
        sheetUsage.set(ss.id, currentUsage + 1);
        const open: OpenSheet = {
          stockSheet: ss,
          sheetIndex: currentUsage,
          tree: createTree(usable.length, usable.width),
          usableLength: usable.length,
          usableWidth: usable.width,
        };
        // Offset placements by trim
        open.tree.x = ss.trimLeft;
        open.tree.y = ss.trimTop;
        openSheets.push(open);
        return open;
      }
    }
    return null;
  }

  // Place each panel
  for (const sortedItem of sorted) {
    const panel = expanded[sortedItem.index];
    const pieceW = panel.length;
    const pieceH = panel.width;
    const color = getColor(panel.originalIndex);
    let placed = false;

    // Per-piece rotation: strategy may allow rotation, but lockRotation overrides it
    const allowRotation = strategy.allowRotation && !panel.lockRotation;

    // Try existing open sheets
    for (const os of openSheets) {
      const placement = placeInTree(
        os.tree,
        pieceW,
        pieceH,
        kerf,
        strategy.selectionRule,
        strategy.splitRule,
        allowRotation,
        { panelId: panel.panelId, label: panel.label, color }
      );
      if (placement) {
        placed = true;
        break;
      }
    }

    // Open a new sheet if needed
    if (!placed) {
      const newSheet = openNewSheet(pieceW, pieceH, allowRotation);
      if (newSheet) {
        const placement = placeInTree(
          newSheet.tree,
          pieceW,
          pieceH,
          kerf,
          strategy.selectionRule,
          strategy.splitRule,
          allowRotation,
          { panelId: panel.panelId, label: panel.label, color }
        );
        if (placement) {
          placed = true;
        }
      }
    }

    if (!placed) {
      unplacedCounts.set(panel.panelId, (unplacedCounts.get(panel.panelId) ?? 0) + 1);
    }
  }

  // Build unplaced list: quantity = number of unplaced instances (not original qty)
  const unplaced: Panel[] = [];
  for (const [panelId, count] of unplacedCounts.entries()) {
    const original = panels.find((p) => p.id === panelId);
    if (original) unplaced.push({ ...original, quantity: count });
  }

  // Build sheet layouts
  const sheetLayouts: SheetLayout[] = openSheets.map((os) => {
    const placements = collectPlacements(os.tree);
    const { steps: cutSequence, isApproximate: cutSequenceApproximate } =
      deriveCutSequenceFromPlacements(placements, os.stockSheet.length, os.stockSheet.width, {
        left: os.stockSheet.trimLeft,
        top: os.stockSheet.trimTop,
        right: os.stockSheet.trimRight,
        bottom: os.stockSheet.trimBottom,
      });
    const usableL = os.stockSheet.length - os.stockSheet.trimLeft - os.stockSheet.trimRight;
    const usableW = os.stockSheet.width - os.stockSheet.trimTop - os.stockSheet.trimBottom;
    const totalArea = usableL * usableW;
    // Used area is the sum of finished part areas (raw, no kerf). Everything else
    // in the usable sheet — offcuts AND the material turned to dust by the saw
    // kerf — counts as waste. This is intentional: kerf is truly lost material.
    const usedArea = placements.reduce((sum, p) => sum + p.width * p.height, 0);
    const wastePercent = ((totalArea - usedArea) / totalArea) * 100;

    return {
      stockSheetId: os.stockSheet.id,
      sheetIndex: os.sheetIndex,
      placements,
      cutSequence,
      cutSequenceApproximate,
      wastePercent,
      usedArea,
    };
  });

  const totalArea = sheetLayouts.reduce(
    (sum, sl) => {
      const ss = stockSheets.find((s) => s.id === sl.stockSheetId)!;
      const usableL = ss.length - ss.trimLeft - ss.trimRight;
      const usableW = ss.width - ss.trimTop - ss.trimBottom;
      return sum + usableL * usableW;
    },
    0
  );
  const totalUsed = sheetLayouts.reduce((sum, sl) => sum + sl.usedArea, 0);
  const totalWaste = totalArea > 0 ? ((totalArea - totalUsed) / totalArea) * 100 : 0;

  return {
    id: nanoid(),
    strategyName: strategy.name,
    sheets: sheetLayouts,
    totalWaste,
    totalSheets: sheetLayouts.length,
    unplacedPanels: unplaced,
  };
}

/** Total number of saw cuts across every sheet in a solution (fewer is better) */
function countCuts(solution: Solution): number {
  return solution.sheets.reduce((sum, sh) => sum + sh.cutSequence.length, 0);
}

/**
 * Count how many placed pieces sit against their panel group's minority
 * orientation. Identical parts cut in the same orientation can be gang-cut
 * (one rip, then crosscut), so a layout that keeps a group consistent scores 0.
 * Each off-orientation piece adds 1.
 */
function orientationInconsistency(solution: Solution): number {
  // Tally rotated vs. un-rotated per panelId across all sheets.
  const groups = new Map<string, { rot: number; norm: number }>();
  for (const sheet of solution.sheets) {
    for (const p of sheet.placements) {
      const g = groups.get(p.panelId) ?? { rot: 0, norm: 0 };
      if (p.rotated) g.rot++;
      else g.norm++;
      groups.set(p.panelId, g);
    }
  }
  let penalty = 0;
  for (const { rot, norm } of groups.values()) {
    // Minority count = pieces that break the group's dominant orientation.
    penalty += Math.min(rot, norm);
  }
  return penalty;
}

/** Run all strategies and return solutions sorted by cut-friendliness (best first) */
export function solveAll(config: {
  stockSheets: StockSheet[];
  panels: Panel[];
  kerf: number;
}): Solution[] {
  const strategies = generateStrategies();
  const solutions: Solution[] = [];

  for (const strategy of strategies) {
    try {
      const solution = solveWithStrategy(
        config.stockSheets,
        config.panels,
        config.kerf,
        strategy
      );
      solutions.push(solution);
    } catch (e) {
      console.warn(`Strategy ${strategy.name} failed:`, e);
    }
  }

  // Sort by cut-friendliness, not just waste. A woodworker prefers a layout
  // that (1) uses the fewest sheets, then (2) keeps identical parts in the same
  // orientation so they can be gang-cut (rip once, crosscut into identical
  // pieces), then (3) wastes little, then (4) needs fewer saw cuts.
  //
  // Sheet count is the hard cost — it's what you actually pay for — so it stays
  // first. But once sheet count is equal, a clean same-orientation plan beats a
  // lower-waste one: the extra offcut is scrap you were keeping anyway, whereas
  // an inconsistent orientation forces a separate saw setup and risks grain
  // mismatch on parts that are supposed to be identical.
  const scored = solutions.map((s) => ({
    solution: s,
    unplaced: s.unplacedPanels.reduce((sum, p) => sum + p.quantity, 0),
    totalCuts: countCuts(s),
    orientationPenalty: orientationInconsistency(s),
    // Round waste to whole percent so a 0.3% waste win doesn't reorder plans
    // that are practically equivalent on material.
    wasteBucket: Math.round(s.totalWaste),
  }));

  scored.sort((a, b) => {
    // A layout that drops panels is never acceptable if a complete one exists —
    // completeness comes before every quality signal, including sheet count and
    // orientation. (A no-rotation strategy can leave a part unplaced yet score a
    // perfect orientation penalty of 0; without this it could outrank a full
    // layout.)
    if (a.unplaced !== b.unplaced) return a.unplaced - b.unplaced;
    if (a.solution.totalSheets !== b.solution.totalSheets)
      return a.solution.totalSheets - b.solution.totalSheets;
    if (a.orientationPenalty !== b.orientationPenalty)
      return a.orientationPenalty - b.orientationPenalty;
    if (a.wasteBucket !== b.wasteBucket) return a.wasteBucket - b.wasteBucket;
    if (a.totalCuts !== b.totalCuts) return a.totalCuts - b.totalCuts;
    // Final tie-break: exact waste.
    return a.solution.totalWaste - b.solution.totalWaste;
  });

  solutions.length = 0;
  solutions.push(...scored.map((x) => x.solution));

  // Deduplicate solutions that produce identical layouts
  const unique: Solution[] = [];
  const seen = new Set<string>();
  for (const sol of solutions) {
    const key = sol.sheets
      .map((s) =>
        s.placements
          .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.width.toFixed(2)},${p.height.toFixed(2)}`)
          .sort()
          .join('|')
      )
      .sort()
      .join('||');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(sol);
    }
  }

  return unique;
}
