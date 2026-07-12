/**
 * Free-rectangle geometry shared by the anchored re-optimizer and the
 * post-greedy improvement pass. Kept in one place so both use identical
 * kerf/overlap semantics.
 */

export interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: FreeRect, b: FreeRect): boolean {
  return !(
    b.x >= a.x + a.w ||
    b.x + b.w <= a.x ||
    b.y >= a.y + a.h ||
    b.y + b.h <= a.y
  );
}

export function subtractRect(freeRects: FreeRect[], used: FreeRect): FreeRect[] {
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

export function pruneContained(freeRects: FreeRect[]): FreeRect[] {
  return freeRects.filter(
    (a) => !freeRects.some(
      (b) => b !== a && b.x <= a.x && b.y <= a.y &&
             b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h
    )
  );
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

/**
 * Reserve a placed piece plus a saw-kerf gap on every side, then remove it from
 * the free rectangles. Padding on all four sides (not just right/bottom) is what
 * guarantees a neighbouring part can never butt directly against this one with
 * zero blade clearance.
 */
export function reserveWithKerf(
  freeRects: FreeRect[],
  x: number,
  y: number,
  w: number,
  h: number,
  kerf: number,
): FreeRect[] {
  return subtractRect(freeRects, {
    x: x - kerf,
    y: y - kerf,
    w: w + 2 * kerf,
    h: h + 2 * kerf,
  });
}

/**
 * Build the initial free-rectangle list for a sheet's usable (post-trim) area
 * and subtract every already-placed piece (with kerf padding). Returns the
 * remaining free rectangles a new piece could occupy.
 */
export function freeRectsForSheet(
  sheet: { length: number; width: number; trimLeft: number; trimRight: number; trimTop: number; trimBottom: number },
  placements: Array<{ x: number; y: number; width: number; height: number }>,
  kerf: number,
): FreeRect[] {
  const usableX = sheet.trimLeft;
  const usableY = sheet.trimTop;
  const usableW = sheet.length - sheet.trimLeft - sheet.trimRight;
  const usableH = sheet.width - sheet.trimTop - sheet.trimBottom;
  let free: FreeRect[] = [{ x: usableX, y: usableY, w: usableW, h: usableH }];
  for (const p of placements) {
    free = reserveWithKerf(free, p.x, p.y, p.width, p.height, kerf);
    free = pruneContained(free);
  }
  return free;
}
