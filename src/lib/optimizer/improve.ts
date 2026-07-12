import { nanoid } from 'nanoid';
import { Solution, SheetLayout, StockSheet, Panel, Placement } from './types';
import { FIT_EPS } from './guillotine';
import { deriveCutSequenceFromPlacements } from './reoptimize';
import { FreeRect, freeRectsForSheet, reserveWithKerf, pruneContained } from './freerect';

/**
 * Post-greedy local-search improvement pass.
 *
 * The greedy first-fit-decreasing sweep can open an extra sheet or strand a
 * large part (ticket OPUS-393). This pass runs a *sheet-elimination relocate*:
 * it repeatedly tries to empty the least-utilised sheet by relocating all of its
 * pieces into free space on the other sheets. Emptying a sheet drops the sheet
 * count — the top term in the ranking objective — which is the single biggest
 * material win available.
 *
 * It is conservative by construction: a move set is committed only if EVERY
 * piece on the target sheet finds a home elsewhere, so the result always has one
 * fewer sheet and never drops a part. The caller additionally guards with
 * `compareSolutions` (best-of greedy vs improved), so a pathological pass can
 * never ship a worse layout than the greedy baseline.
 */

// ─── Objective (mirrors solveAll's comparator) ────────────────────────────────

export interface SolutionScore {
  unplaced: number;
  totalSheets: number;
  orientationPenalty: number;
  wasteBucket: number;
  totalCuts: number;
  exactWaste: number;
}

function orientationInconsistency(solution: Solution): number {
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
  for (const { rot, norm } of groups.values()) penalty += Math.min(rot, norm);
  return penalty;
}

/** Score a solution on the same lexicographic objective solveAll sorts by. */
export function scoreSolution(solution: Solution): SolutionScore {
  return {
    unplaced: solution.unplacedPanels.reduce((sum, p) => sum + p.quantity, 0),
    totalSheets: solution.totalSheets,
    orientationPenalty: orientationInconsistency(solution),
    wasteBucket: Math.round(solution.totalWaste),
    totalCuts: solution.sheets.reduce((sum, sh) => sum + sh.cutSequence.length, 0),
    exactWaste: solution.totalWaste,
  };
}

/** Negative when `a` is strictly better than `b` (same order as solveAll's sort). */
export function compareScores(a: SolutionScore, b: SolutionScore): number {
  if (a.unplaced !== b.unplaced) return a.unplaced - b.unplaced;
  if (a.totalSheets !== b.totalSheets) return a.totalSheets - b.totalSheets;
  if (a.orientationPenalty !== b.orientationPenalty) return a.orientationPenalty - b.orientationPenalty;
  if (a.wasteBucket !== b.wasteBucket) return a.wasteBucket - b.wasteBucket;
  if (a.totalCuts !== b.totalCuts) return a.totalCuts - b.totalCuts;
  return a.exactWaste - b.exactWaste;
}

/** Return whichever solution scores better; ties keep `current` (the incumbent). */
export function bestOf(current: Solution, candidate: Solution): Solution {
  return compareScores(scoreSolution(candidate), scoreSolution(current)) < 0 ? candidate : current;
}

// ─── Sheet-elimination relocate ───────────────────────────────────────────────

interface WorkingSheet {
  layout: SheetLayout;
  stock: StockSheet;
  placements: Placement[];
  free: FreeRect[];
}

/** Try to place one piece into a sheet's free rectangles. Returns the committed
 *  placement (with updated x/y/width/height/rotated) or null if it doesn't fit.
 *  Respects the panel's rotation lock. Best-area-fit selection. */
function tryPlace(
  ws: WorkingSheet,
  piece: Placement,
  canRotate: boolean,
  kerf: number,
): Placement | null {
  // The piece's current on-sheet footprint, and its rotated footprint.
  const dims: Array<{ w: number; h: number; rotated: boolean }> = [
    { w: piece.width, h: piece.height, rotated: piece.rotated },
  ];
  if (canRotate && Math.abs(piece.width - piece.height) > FIT_EPS) {
    dims.push({ w: piece.height, h: piece.width, rotated: !piece.rotated });
  }

  let best: { rect: FreeRect; w: number; h: number; rotated: boolean; leftover: number } | null = null;
  for (const rect of ws.free) {
    for (const d of dims) {
      // Fit against the RAW piece size — kerf is consumed only BETWEEN adjacent
      // pieces (reserved on subtraction below via reserveWithKerf), never against
      // a free-rect boundary. Adding kerf here double-charged it on a neighbour
      // edge and charged it spuriously against the sheet edge, rejecting valid
      // boundary-flush placements (OPUS-399). Matches the guillotine/reoptimize
      // fit convention: `r.w >= pieceW - FIT_EPS`.
      if (d.w <= rect.w + FIT_EPS && d.h <= rect.h + FIT_EPS) {
        const leftover = rect.w * rect.h - d.w * d.h;
        if (!best || leftover < best.leftover) {
          best = { rect, w: d.w, h: d.h, rotated: d.rotated, leftover };
        }
      }
    }
  }
  if (!best) return null;

  const placed: Placement = {
    ...piece,
    x: best.rect.x,
    y: best.rect.y,
    width: best.w,
    height: best.h,
    rotated: best.rotated,
  };
  ws.placements.push(placed);
  ws.free = pruneContained(reserveWithKerf(ws.free, placed.x, placed.y, best.w, best.h, kerf));
  return placed;
}

function rebuildLayout(ws: WorkingSheet): SheetLayout {
  const { steps: cutSequence, isApproximate: cutSequenceApproximate } =
    deriveCutSequenceFromPlacements(ws.placements, ws.stock.length, ws.stock.width, {
      left: ws.stock.trimLeft,
      top: ws.stock.trimTop,
      right: ws.stock.trimRight,
      bottom: ws.stock.trimBottom,
    });
  const usableL = ws.stock.length - ws.stock.trimLeft - ws.stock.trimRight;
  const usableW = ws.stock.width - ws.stock.trimTop - ws.stock.trimBottom;
  const totalArea = usableL * usableW;
  const usedArea = ws.placements.reduce((s, p) => s + p.width * p.height, 0);
  return {
    ...ws.layout,
    placements: ws.placements,
    cutSequence,
    cutSequenceApproximate,
    usedArea,
    wastePercent: totalArea > 0 ? ((totalArea - usedArea) / totalArea) * 100 : 0,
  };
}

function rebuildSolution(sheets: SheetLayout[], stockSheets: StockSheet[], base: Solution): Solution {
  const totalArea = sheets.reduce((s, sl) => {
    const ss = stockSheets.find((x) => x.id === sl.stockSheetId);
    if (!ss) return s;
    return s + (ss.length - ss.trimLeft - ss.trimRight) * (ss.width - ss.trimTop - ss.trimBottom);
  }, 0);
  const totalUsed = sheets.reduce((s, sl) => s + sl.usedArea, 0);
  return {
    ...base,
    id: nanoid(),
    sheets,
    totalSheets: sheets.length,
    totalWaste: totalArea > 0 ? ((totalArea - totalUsed) / totalArea) * 100 : 0,
  };
}

/**
 * Attempt to eliminate sheets from a solution by relocating pieces. Time-boxed
 * by a max-pass count. Returns a solution with the same or fewer sheets and the
 * same placed pieces — never worse on the ranking objective.
 */
export function improveSolution(
  solution: Solution,
  stockSheets: StockSheet[],
  panels: Panel[],
  kerf: number,
  opts: { maxPasses?: number } = {},
): Solution {
  const maxPasses = opts.maxPasses ?? 8;
  const lockById = new Map(panels.map((p) => [p.id, p.lockRotation]));

  // Work on a mutable copy of the sheet list.
  let sheets: SheetLayout[] = solution.sheets.map((s) => ({
    ...s,
    placements: s.placements.map((p) => ({ ...p })),
  }));

  for (let pass = 0; pass < maxPasses; pass++) {
    if (sheets.length <= 1) break;

    // Target the emptiest sheet (least used area) — cheapest to clear.
    const order = sheets
      .map((s, i) => ({ i, used: s.usedArea }))
      .sort((a, b) => a.used - b.used);

    let eliminated = false;
    for (const { i: targetIdx } of order) {
      const target = sheets[targetIdx];
      if (target.placements.length === 0) {
        // An already-empty sheet: just drop it.
        sheets = sheets.filter((_, idx) => idx !== targetIdx);
        eliminated = true;
        break;
      }

      // Build working sheets for every OTHER sheet, seeded with their current
      // pieces and remaining free space.
      const others: WorkingSheet[] = sheets
        .map((layout, idx) => ({ layout, idx }))
        .filter(({ idx }) => idx !== targetIdx)
        .map(({ layout }) => {
          const stock = stockSheets.find((s) => s.id === layout.stockSheetId)!;
          return {
            layout,
            stock,
            placements: layout.placements.map((p) => ({ ...p })),
            free: freeRectsForSheet(stock, layout.placements, kerf),
          };
        });

      // Try to rehome every piece from the target, largest first (harder to fit).
      const toMove = [...target.placements].sort(
        (a, b) => b.width * b.height - a.width * a.height,
      );
      const committed: WorkingSheet[] = others;
      let allMoved = true;
      for (const piece of toMove) {
        const canRotate = !(lockById.get(piece.panelId) ?? false);
        let placed = false;
        // Prefer the fullest sheet that still has room (keeps offcuts consolidated).
        for (const ws of [...committed].sort((a, b) => b.placements.length - a.placements.length)) {
          if (tryPlace(ws, piece, canRotate, kerf)) { placed = true; break; }
        }
        if (!placed) { allMoved = false; break; }
      }

      if (allMoved) {
        // Rebuild the surviving sheets and derive their cut sequences.
        const rebuilt = committed.map((ws) => rebuildLayout(ws));

        // Guard (OPUS-398): a relocation can pack pieces into a non-guillotine
        // arrangement (e.g. a pinwheel), whose derived cut sequence is only an
        // approximation — a saw cut would pass through a placed part. The ranking
        // objective (compareScores) has no term for that, so `solveAll` would
        // happily promote such a layout just because it uses one fewer sheet.
        // Reject any elimination that leaves an approximate sheet and try the
        // next target instead; the guillotine-valid baseline is kept.
        if (rebuilt.some((s) => s.cutSequenceApproximate)) {
          continue;
        }

        // Commit: drop the emptied sheet, keep the rebuilt (guillotine-valid) ones.
        sheets = rebuilt;
        eliminated = true;
        break;
      }
      // Otherwise leave `sheets` untouched and try the next candidate.
    }

    if (!eliminated) break; // converged — no sheet could be emptied this pass
  }

  const improved = rebuildSolution(sheets, stockSheets, solution);
  // Final guard: never return something worse than the input.
  return bestOf(solution, improved);
}
