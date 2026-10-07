import { nanoid } from 'nanoid';
import {
  StockSheet,
  Panel,
  PanelGrain,
  Solution,
  SheetLayout,
  PackingStrategy,
  GuillotineNode,
  CutPreference,
} from './types';
import { createTree, placeInTree, collectPlacements, FIT_EPS } from './guillotine';
import { deriveCutSequenceFromPlacements } from './reoptimize';
import { generateStrategies, sortPanels } from './strategies';
import { getColor } from '../colors';
import { solverOrientations } from '../grain';
import { evaluateCutOrder, isHardCutPreference, preferredFirstCut } from './cut-order';
import { improveSolution, scoreSolution, compareScores } from './improve';

interface ExpandedPanel {
  panelId: string;
  label: string;
  length: number;
  width: number;
  originalIndex: number;
  grain: PanelGrain;
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
        grain: panel.grain,
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
  strategy: PackingStrategy,
  cutPreference: CutPreference
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

  function openNewSheet(minLength: number, minWidth: number, grain: PanelGrain): OpenSheet | null {
    // Find the smallest stock sheet that can fit the piece
    for (const ss of availableSheets) {
      const usable = getUsableDimensions(ss);
      const currentUsage = sheetUsage.get(ss.id) || 0;
      if (currentUsage >= ss.quantity) continue;

      // Use the same tolerance the tree placement uses, so a piece the tree
      // would accept (e.g. an exact metric fit off by float drift) also opens
      // a sheet instead of being reported unplaced. Only orientations the
      // panel's grain allows on this particular sheet count.
      const o = solverOrientations(grain, ss, strategy.allowRotation);
      const fits =
        (o.normal && usable.length >= minLength - FIT_EPS && usable.width >= minWidth - FIT_EPS) ||
        (o.rotated &&
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

    // Try existing open sheets. Allowed orientations depend on each sheet's
    // grain, so they are worked out per sheet.
    for (const os of openSheets) {
      const placement = placeInTree(
        os.tree,
        pieceW,
        pieceH,
        kerf,
        strategy.selectionRule,
        strategy.splitRule,
        solverOrientations(panel.grain, os.stockSheet, strategy.allowRotation),
        { panelId: panel.panelId, label: panel.label, color },
        strategy.firstStage
      );
      if (placement) {
        placed = true;
        break;
      }
    }

    // Open a new sheet if needed
    if (!placed) {
      const newSheet = openNewSheet(pieceW, pieceH, panel.grain);
      if (newSheet) {
        const placement = placeInTree(
          newSheet.tree,
          pieceW,
          pieceH,
          kerf,
          strategy.selectionRule,
          strategy.splitRule,
          solverOrientations(panel.grain, newSheet.stockSheet, strategy.allowRotation),
          { panelId: panel.panelId, label: panel.label, color },
          strategy.firstStage
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
      }, { firstCut: preferredFirstCut(cutPreference) });
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
    cutOrder: evaluateCutOrder(sheetLayouts, stockSheets, cutPreference),
  };
}

/** Run all strategies and return solutions sorted by cut-friendliness (best first) */
export function solveAll(config: {
  stockSheets: StockSheet[];
  panels: Panel[];
  kerf: number;
  cutPreference?: CutPreference;
}): Solution[] {
  const cutPreference = config.cutPreference ?? 'auto';
  const firstCut = preferredFirstCut(cutPreference);
  const base = generateStrategies();
  // With a cut-order preference, also run every strategy in strip mode for the
  // preferred direction, so layouts that start with that cut are in the pool.
  const strategies = firstCut
    ? [
        ...base,
        ...base.map((st) => ({
          ...st,
          name: `${st.name}/${firstCut === 'horizontal' ? 'rip' : 'crosscut'}-strips`,
          firstStage: firstCut,
        })),
      ]
    : base;
  const solutions: Solution[] = [];

  for (const strategy of strategies) {
    try {
      const solution = solveWithStrategy(
        config.stockSheets,
        config.panels,
        config.kerf,
        strategy,
        cutPreference
      );
      solutions.push(solution);
    } catch (e) {
      console.warn(`Strategy ${strategy.name} failed:`, e);
    }
  }

  // Sort by cut-friendliness, not just waste (see compareScores in improve.ts).
  // A woodworker prefers a layout that (1) places every part, then (2) uses the
  // fewest sheets, then (3) keeps identical parts in the same orientation so
  // they can be gang-cut (rip once, crosscut into identical pieces), then (4)
  // wastes little, then (5) needs fewer saw cuts.
  //
  // Sheet count is the hard cost (it's what you actually pay for), so it stays
  // ahead of the quality signals. A 'favor-*' cut preference ranks right after
  // it, so honoring it never costs a sheet; an 'always-*' preference ranks
  // ahead of it, because the user asked for it even at a material cost.
  // Once sheet count is equal, a clean same-orientation plan beats a
  // lower-waste one: the extra offcut is scrap you were keeping anyway, whereas
  // an inconsistent orientation forces a separate saw setup and risks grain
  // mismatch on parts that are supposed to be identical.
  const scored = solutions.map((s) => ({ solution: s, score: scoreSolution(s) }));
  scored.sort((a, b) => compareScores(a.score, b.score));

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

  // ── Local-search improvement pass ───────────────────────────────────────────
  // Run a sheet-elimination relocate on the best candidate. It only ever removes
  // a sheet (the top ranking term), and improveSolution's internal best-of guard
  // means the result can never rank worse than the greedy baseline. If it does
  // improve, re-insert it at the front so the UI shows the better plan first; the
  // untouched greedy result stays available as an alternative layout.
  if (unique.length > 0) {
    const greedyBest = unique[0];
    const improved = improveSolution(greedyBest, config.stockSheets, config.panels, config.kerf, {
      cutPreference,
    });
    if (improved !== greedyBest && compareScores(scoreSolution(improved), scoreSolution(greedyBest)) < 0) {
      unique.unshift(improved);
    }
  }

  // An 'always-*' preference is a requirement, so when the best layout meets
  // it, drop the alternatives that don't. When nothing meets it, every layout
  // is kept and each one reports its mismatched sheets for the UI to flag.
  if (isHardCutPreference(cutPreference) && unique[0]?.cutOrder?.mismatchedSheets === 0) {
    return unique.filter((sol) => (sol.cutOrder?.mismatchedSheets ?? 0) === 0);
  }

  return unique;
}
