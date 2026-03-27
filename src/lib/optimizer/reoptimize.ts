import { nanoid } from 'nanoid';
import { Solution, SheetLayout, StockSheet, Placement, CutStep } from './types';

// ─── Free-rectangle helpers ───────────────────────────────────────────────────

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: FreeRect, b: FreeRect): boolean {
  return !(
    b.x >= a.x + a.w ||
    b.x + b.w <= a.x ||
    b.y >= a.y + a.h ||
    b.y + b.h <= a.y
  );
}

function subtractRect(freeRects: FreeRect[], used: FreeRect): FreeRect[] {
  const result: FreeRect[] = [];
  for (const f of freeRects) {
    if (!overlaps(f, used)) { result.push(f); continue; }
    if (used.x > f.x)
      result.push({ x: f.x, y: f.y, w: used.x - f.x, h: f.h });
    if (used.x + used.w < f.x + f.w)
      result.push({ x: used.x + used.w, y: f.y, w: f.x + f.w - (used.x + used.w), h: f.h });
    if (used.y > f.y)
      result.push({ x: f.x, y: f.y, w: f.w, h: used.y - f.y });
    if (used.y + used.h < f.y + f.h)
      result.push({ x: f.x, y: used.y + used.h, w: f.w, h: f.y + f.h - (used.y + used.h) });
  }
  return result;
}

function pruneContained(freeRects: FreeRect[]): FreeRect[] {
  return freeRects.filter(
    (a) => !freeRects.some(
      (b) => b !== a && b.x <= a.x && b.y <= a.y &&
             b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h
    )
  );
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

// ─── Cut-sequence from placements ─────────────────────────────────────────────

/**
 * Derive a practical cut sequence from placed pieces.
 * Generates horizontal "rip cuts" first, then vertical cross-cuts,
 * ordered from one side to the other (typical woodworking sequence).
 */
/**
 * Merge a sorted list of positions, collapsing any within `epsilon` of the
 * previous kept value into one (keeps the first in each cluster).
 */
function deduplicatePositions(positions: number[], epsilon: number): number[] {
  const sorted = [...positions].sort((a, b) => a - b);
  const result: number[] = [];
  for (const pos of sorted) {
    if (result.length === 0 || pos - result[result.length - 1] > epsilon) {
      result.push(pos);
    }
  }
  return result;
}

/**
 * Subtract a list of blocked intervals from [lo, hi].
 * Returns the remaining free sub-intervals (each at least minLen wide).
 */
function subtractRanges(
  lo: number,
  hi: number,
  blocked: Array<[number, number]>,
  minLen = 0.05,
): Array<[number, number]> {
  const sorted = [...blocked].sort((a, b) => a[0] - b[0]);
  let remaining: Array<[number, number]> = [[lo, hi]];
  for (const [blo, bhi] of sorted) {
    const next: Array<[number, number]> = [];
    for (const [rlo, rhi] of remaining) {
      if (bhi <= rlo || blo >= rhi) { next.push([rlo, rhi]); continue; }
      if (rlo < blo - minLen) next.push([rlo, blo]);
      if (bhi < rhi - minLen) next.push([bhi, rhi]);
    }
    remaining = next;
  }
  return remaining.filter(([a, b]) => b - a > minLen);
}

/**
 * Compute the line segments for a cut, clipped around any pieces that
 * straddle the cut line (a piece whose body the blade would pass through).
 */
function clippedSegments(
  orientation: 'horizontal' | 'vertical',
  position: number,
  sheetW: number,
  sheetH: number,
  placements: Placement[],
  eps = 0.05,
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  if (orientation === 'horizontal') {
    // Pieces whose body straddles y=position (not just touching at edges)
    const blocking = placements.filter(
      (p) => p.y < position - eps && p.y + p.height > position + eps,
    );
    const blockedX = blocking.map((p): [number, number] => [p.x, p.x + p.width]);
    return subtractRanges(0, sheetW, blockedX).map(([lo, hi]) => ({
      x1: lo, y1: position, x2: hi, y2: position,
    }));
  } else {
    const blocking = placements.filter(
      (p) => p.x < position - eps && p.x + p.width > position + eps,
    );
    const blockedY = blocking.map((p): [number, number] => [p.y, p.y + p.height]);
    return subtractRanges(0, sheetH, blockedY).map(([lo, hi]) => ({
      x1: position, y1: lo, x2: position, y2: hi,
    }));
  }
}

/** Return the midpoint of the longest segment (for badge placement). */
function badgeAnchor(
  segs: Array<{ x1: number; y1: number; x2: number; y2: number }>,
  fallback: { x1: number; y1: number; x2: number; y2: number },
) {
  if (segs.length === 0) return fallback;
  const longest = segs.reduce((best, s) => {
    const len = Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1);
    const blen = Math.abs(best.x2 - best.x1) + Math.abs(best.y2 - best.y1);
    return len > blen ? s : best;
  }, segs[0]);
  return {
    x1: (longest.x1 + longest.x2) / 2,
    y1: (longest.y1 + longest.y2) / 2,
    x2: (longest.x1 + longest.x2) / 2,
    y2: (longest.y1 + longest.y2) / 2,
  };
}

export function deriveCutSequenceFromPlacements(
  placements: Placement[],
  sheetW: number,
  sheetH: number,
): CutStep[] {
  if (placements.length < 2) return [];

  const epsilon = 0.25; // quarter-inch: merge nearly-identical cut lines
  const edgeEpsilon = 0.05; // strip positions flush with the sheet edge

  const rawXCuts: number[] = [];
  const rawYCuts: number[] = [];

  for (const p of placements) {
    const right = p.x + p.width;
    const bottom = p.y + p.height;
    if (right < sheetW - edgeEpsilon) rawXCuts.push(right);
    if (bottom < sheetH - edgeEpsilon) rawYCuts.push(bottom);
  }

  const sortedY = deduplicatePositions(rawYCuts, epsilon);
  const sortedX = deduplicatePositions(rawXCuts, epsilon);

  const steps: CutStep[] = [];
  let n = 1;

  // Horizontal cuts first (rip cuts)
  for (const y of sortedY) {
    const segs = clippedSegments('horizontal', y, sheetW, sheetH, placements);
    if (segs.length === 0) continue;
    const anchor = badgeAnchor(segs, { x1: 0, y1: y, x2: sheetW, y2: y });
    steps.push({
      stepNumber: n++,
      orientation: 'horizontal',
      x1: anchor.x1, y1: anchor.y1, x2: anchor.x2, y2: anchor.y2,
      segments: segs,
    });
  }
  // Then vertical cuts
  for (const x of sortedX) {
    const segs = clippedSegments('vertical', x, sheetW, sheetH, placements);
    if (segs.length === 0) continue;
    const anchor = badgeAnchor(segs, { x1: x, y1: 0, x2: x, y2: sheetH });
    steps.push({
      stepNumber: n++,
      orientation: 'vertical',
      x1: anchor.x1, y1: anchor.y1, x2: anchor.x2, y2: anchor.y2,
      segments: segs,
    });
  }

  return steps;
}

// ─── Main re-optimizer ────────────────────────────────────────────────────────

/**
 * Re-pack all non-pinned pieces on each sheet using free-rectangle packing.
 * Pinned pieces act as SOFT ANCHORS — they get priority to land nearest their
 * preferred center, but can shift to any valid free rect if kerf or space
 * prevents an exact fit. This is a "preference" not a fixed coordinate.
 */
export function reOptimizeAroundPinned(
  solution: Solution,
  stockSheets: StockSheet[],
  pinnedPieces: Set<string>, // keys: "stockSheetId-sheetIndex:placementIndex"
  kerf: number
): Solution {
  const newSheets: SheetLayout[] = solution.sheets.map((sheet) => {
    const stockSheet = stockSheets.find((s) => s.id === sheet.stockSheetId);
    if (!stockSheet) return sheet;

    const sheetKey = `${sheet.stockSheetId}-${sheet.sheetIndex}`;

    // Separate pinned (soft-anchor) from free-floating
    type AnchoredPanel = Placement & { prefCX: number; prefCY: number };
    const anchored: AnchoredPanel[] = [];
    const floating: Placement[] = [];

    sheet.placements.forEach((p, pi) => {
      if (pinnedPieces.has(`${sheetKey}:${pi}`)) {
        anchored.push({ ...p, prefCX: p.x + p.width / 2, prefCY: p.y + p.height / 2 });
      } else {
        floating.push(p);
      }
    });

    // Full usable free area
    const usableX = stockSheet.trimLeft;
    const usableY = stockSheet.trimTop;
    const usableW = stockSheet.length - stockSheet.trimLeft - stockSheet.trimRight;
    const usableH = stockSheet.width - stockSheet.trimTop - stockSheet.trimBottom;
    let freeRects: FreeRect[] = [{ x: usableX, y: usableY, w: usableW, h: usableH }];

    const newPlacements: Placement[] = [];
    const unplacedFloating: Placement[] = [];

    // ── Pass 1: soft-anchored pieces → closest free rect to preference ──────
    // Sort by area desc so large anchored pieces claim their space first
    const sortedAnchored = [...anchored].sort(
      (a, b) => b.width * b.height - a.width * a.height
    );

    for (const panel of sortedAnchored) {
      const pw = panel.width + kerf;
      const ph = panel.height + kerf;

      // Score each free rect by distance from preferred center
      let bestIdx = -1;
      let bestScore = Infinity;
      let bestRotated = false;

      for (let i = 0; i < freeRects.length; i++) {
        const r = freeRects[i];
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;

        if (r.w >= pw && r.h >= ph) {
          const score = dist2(cx, cy, panel.prefCX, panel.prefCY);
          if (score < bestScore) { bestScore = score; bestIdx = i; bestRotated = false; }
        }
        // Try rotated
        if (r.w >= ph && r.h >= pw) {
          const score = dist2(cx, cy, panel.prefCX, panel.prefCY);
          if (score < bestScore) { bestScore = score; bestIdx = i; bestRotated = true; }
        }
      }

      if (bestIdx === -1) {
        // Can't place it at all — put it back as a floating piece
        floating.push(panel);
        continue;
      }

      const rect = freeRects[bestIdx];
      const placeW = bestRotated ? panel.height : panel.width;
      const placeH = bestRotated ? panel.width : panel.height;

      // Place as close to preferred position as possible within the rect
      const clampedX = Math.max(rect.x, Math.min(panel.prefCX - placeW / 2, rect.x + rect.w - placeW));
      const clampedY = Math.max(rect.y, Math.min(panel.prefCY - placeH / 2, rect.y + rect.h - placeH));

      newPlacements.push({
        ...panel,
        x: clampedX,
        y: clampedY,
        width: placeW,
        height: placeH,
        rotated: bestRotated ? !panel.rotated : panel.rotated,
      });

      freeRects = subtractRect(freeRects, { x: clampedX, y: clampedY, w: placeW + kerf, h: placeH + kerf });
      freeRects = pruneContained(freeRects);
    }

    // ── Pass 2: floating pieces → best-fit (smallest area) ──────────────────
    const sortedFloating = [...floating].sort((a, b) => b.width * b.height - a.width * a.height);

    for (const panel of sortedFloating) {
      const pw = panel.width + kerf;
      const ph = panel.height + kerf;

      let bestIdx = -1;
      let bestArea = Infinity;
      let bestRotated = false;

      for (let i = 0; i < freeRects.length; i++) {
        const r = freeRects[i];
        if (r.w >= pw && r.h >= ph) {
          const area = r.w * r.h;
          if (area < bestArea) { bestArea = area; bestIdx = i; bestRotated = false; }
        }
        if (r.w >= ph && r.h >= pw) {
          const area = r.w * r.h;
          if (area < bestArea) { bestArea = area; bestIdx = i; bestRotated = true; }
        }
      }

      if (bestIdx === -1) { unplacedFloating.push(panel); continue; }

      const rect = freeRects[bestIdx];
      const placeW = bestRotated ? panel.height : panel.width;
      const placeH = bestRotated ? panel.width : panel.height;

      newPlacements.push({
        ...panel,
        x: rect.x,
        y: rect.y,
        width: placeW,
        height: placeH,
        rotated: bestRotated ? !panel.rotated : panel.rotated,
      });

      freeRects = subtractRect(freeRects, { x: rect.x, y: rect.y, w: placeW + kerf, h: placeH + kerf });
      freeRects = pruneContained(freeRects);
    }

    // ── Derive fresh cut sequence from new placements ────────────────────────
    const cutSequence = deriveCutSequenceFromPlacements(
      newPlacements,
      stockSheet.length,
      stockSheet.width,
    );

    // Recalculate waste
    const totalArea = stockSheet.length * stockSheet.width;
    const usedArea = newPlacements.reduce((s, p) => s + p.width * p.height, 0);

    return {
      ...sheet,
      placements: newPlacements,
      cutSequence,
      wastePercent: ((totalArea - usedArea) / totalArea) * 100,
      usedArea,
    };
  });

  const totalArea = newSheets.reduce((s, sl) => {
    const ss = stockSheets.find((x) => x.id === sl.stockSheetId);
    return s + (ss ? ss.length * ss.width : 0);
  }, 0);
  const totalUsed = newSheets.reduce((s, sl) => s + sl.usedArea, 0);

  return {
    ...solution,
    id: nanoid(),
    strategyName: 'Re-planned (anchored)',
    sheets: newSheets,
    totalWaste: totalArea > 0 ? ((totalArea - totalUsed) / totalArea) * 100 : 0,
    totalSheets: newSheets.length,
    unplacedPanels: solution.unplacedPanels,
  };
}
