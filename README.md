# Cut Planner

A web-based plywood and sheet goods cutlist optimizer. Enter your stock sheet dimensions and required panels, click **Plan Cuts**, and get visual cutting diagrams with step-by-step cut sequences, alternative layouts, drag-and-drop repositioning, and PDF/PNG export.

**Live:** [cutplanner.stevescher.com](https://cutplanner.stevescher.com)
**Repo:** [github.com/stevescher/cut-planner](https://github.com/stevescher/cut-planner)

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Core Algorithm](#core-algorithm)
5. [State Management](#state-management)
6. [Data Model](#data-model)
7. [Measurement System](#measurement-system)
8. [Drag, Pin & Re-optimize](#drag-pin--re-optimize)
9. [Cut Sequence](#cut-sequence)
10. [Export](#export)
11. [Persistence](#persistence)
12. [UI / Design System](#ui--design-system)
13. [Local Development](#local-development)
14. [Deployment](#deployment)
15. [Known Limitations & Future Work](#known-limitations--future-work)

---

## Features

| Feature | Details |
|---|---|
| **Unit system** | Imperial (fractional inches) or Metric (mm) — set once at the top of the sidebar before entering measurements |
| **Stock sheet entry** | Preset sizes (4×8, 5×5, 2×4, etc. / metric equivalents) or custom dimensions. Per-sheet label, quantity, and optional edge trim (top/right/bottom/left) |
| **Panel entry** | Label, length, width, quantity. Color-coded dots match layout colors |
| **Kerf setting** | Blade kerf in inches or mm — deducted from every cut edge automatically |
| **Plan Cuts** | Runs 15 packing strategies simultaneously, returns top results sorted by waste |
| **Layout alternatives** | Up to 5 solutions shown as numbered pills; "More Layouts" pill (next to the numbered pills) reveals additional strategies |
| **Zoom** | − / % / + zoom controls (50–300%) in the diagram top bar; scales all sheet canvases |
| **Color / Mono / Outline** | Three view modes: color-coded pieces, grayscale, or black outlines only |
| **Labels toggle** | Show/hide piece name and dimensions centered on each piece |
| **Dimensions toggle** | Show/hide width and height labels along each piece's top and left edges — off by default |
| **Cut sequence** | Numbered cut lines showing a practical guillotine cut order — waste isolation cuts first, then piece-separating cuts, recursively within each sub-region |
| **Drag & drop** | Drag any piece to a new position; snaps to piece edges and sheet boundaries |
| **Rotate** | ↺ button on every piece; floats above the piece when the piece is too small to contain it |
| **Unplaced panel fix** | When panels can't fit, a banner explains what's missing and offers "Add N sheet(s) & Re-Plan" — one click adds the estimated extra stock and re-runs the optimizer |
| **Anchor / Re-Plan Cuts** | Pin pieces to hold their position as a preference, then re-plan remaining pieces around them |
| **Undo / Redo** | Full history for all drag, rotate, and re-optimize actions (Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z) |
| **Shop checklist** | Printable table view listing all pieces by sheet with checkboxes |
| **PDF export** | Multi-page PDF: summary + panels needed (page 1), one diagram + cut list per sheet (subsequent pages) |
| **PNG export** | Screenshot of the active layout diagram |
| **Project save/load** | Auto-saves to `localStorage` on every change; export/import as `.json` files |

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.2 (App Router)** | SSG for instant load; App Router for future server features |
| Language | **TypeScript 5** | End-to-end type safety across the optimizer data model |
| Styling | **Tailwind CSS v4** | Utility-first, co-located with components |
| Components | **shadcn/ui v4 + base-ui** | Accessible primitives — uses `render=` prop API, **not** `asChild` |
| State | **Zustand v5** | Minimal stores; fine-grained subscriptions for performance |
| Rendering | **SVG** (inline React) | Full DOM event access for drag-and-drop; easy CSS transitions; exportable |
| PDF | **jsPDF v4** | Pure-JS PDF generation with no server required |
| PNG | **html-to-image** | DOM-to-canvas screenshot of the SVG container |
| IDs | **nanoid** | Short, URL-safe unique IDs for all entities |
| Deploy | **Vercel** | Zero-config Next.js hosting; auto-deploys on push to `main` |

> **Build note:** `next build --webpack` is required. Turbopack fails on Vercel's Linux x64 build environment (native `@next/swc` binary incompatibility). This is already set in `package.json`.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          Root HTML shell, fonts, metadata
│   ├── page.tsx            Single-page app: sidebar + main viewer + keyboard shortcuts
│   └── globals.css         Design tokens (CSS vars), custom utility classes
│
├── components/
│   ├── forms/
│   │   ├── UnitToggle.tsx        Imperial / Metric segmented control (top of sidebar)
│   │   ├── StockSheetForm.tsx    Stock sheet cards: preset dropdown, dimensions, trim
│   │   ├── StockPresetSelect.tsx Preset size dropdown (list switches based on active units)
│   │   ├── PanelForm.tsx         Panel rows with color swatches matching layout colors
│   │   ├── KerfSetting.tsx       Kerf input with unit-aware hint text
│   │   └── NumberInput.tsx       Smart input — accepts fractions ("12 1/2") and decimals
│   │
│   ├── layout-viewer/
│   │   ├── LayoutViewer.tsx      Top bar (layout pills, More Layouts, zoom, view toggle), anchor banner, unplaced-panel fix banner, scroll container
│   │   ├── SheetCanvas.tsx       SVG canvas: pieces, drag, rotate, edge dims, cut lines, piece legend
│   │   └── LayoutControls.tsx    Toolbar: Labels, Dimensions, Cuts, Color/Mono/Outline, Release pins
│   │
│   ├── cut-list/
│   │   └── CutChecklist.tsx      Printable shop checklist (table view with checkboxes)
│   │
│   ├── export/
│   │   └── ExportMenu.tsx        Dropdown: Export as PDF / Export as PNG
│   │
│   ├── project/
│   │   └── ProjectMenu.tsx       Project name, New/Save/Load JSON, auto-save indicator
│   │
│   └── ui/                       shadcn-generated primitives (Button, Input, Select, etc.)
│
├── hooks/
│   ├── useOptimizer.ts     Calls solveAll(), manages isOptimizing state
│   └── useAutoSave.ts      Loads localStorage on mount; saves on every store change
│
├── lib/
│   ├── optimizer/
│   │   ├── types.ts          All TypeScript interfaces + stock presets (imperial & metric)
│   │   ├── guillotine.ts     Binary tree packer: placeInTree, collectPlacements
│   │   ├── strategies.ts     15 strategy combinations (sort × split × selection × rotation)
│   │   ├── solver.ts         solveAll(): runs all strategies, returns Solutions sorted by waste
│   │   ├── reoptimize.ts     Free-rect re-packer for anchored layouts + deriveCutSequenceFromPlacements
│   │   └── cut-sequence.ts   Legacy tree-based cut sequence (no longer called; kept for reference)
│   │
│   ├── export/
│   │   ├── pdf.ts            jsPDF: summary page + per-sheet diagram + cut-list pages
│   │   └── image.ts          html-to-image PNG export
│   │
│   ├── fractions.ts          parseDimension, formatDimension, parseMetric, formatMetric,
│   │                         parseInput, formatDisplay, unitSuffix, defaultKerf
│   ├── colors.ts             20-color palette + 10 mono grays; getColor(index, mono?)
│   ├── project-io.ts         localStorage save/load + JSON file export/import
│   └── utils.ts              cn() Tailwind class merger
│
└── store/
    ├── useProjectStore.ts    Project data: name, stockSheets, panels, kerf, units
    ├── useLayoutStore.ts     Solutions array, activeSolutionIndex, revealedCount, isOptimizing
    ├── useDragStore.ts       pinnedPieces Set<string>, togglePin, isPinned, clearPins
    ├── useHistoryStore.ts    Undo/redo stack (max 50 entries) for layout changes
    └── useViewStore.ts       showLabels, viewMode (color|mono|outline), showCutSequence
```

---

## Core Algorithm

### Guillotine Bin Packing

Every real saw cut goes edge-to-edge, dividing a rectangle into exactly two pieces. Guillotine packing models this as a binary tree where each internal node is a split and each leaf is a placed piece or free space.

**Key files:** `guillotine.ts`, `solver.ts`, `strategies.ts`

#### Placement flow (per piece)

1. Walk the tree to collect all free leaf rectangles (`collectFreeRects`)
2. Score each free rect against the piece dimensions using the strategy's `SelectionRule`
3. If `allowRotation`, also score the piece rotated — take the better-scoring orientation
4. Place the piece in the best-scoring rect; split the node into two children using `SplitRule`

#### Selection rules (which free rect to use)

| Rule | Effect |
|---|---|
| `best-short-side-fit` | Minimize the smaller leftover dimension — compact, tidy layouts |
| `best-long-side-fit` | Minimize the larger leftover dimension |
| `best-area-fit` | Minimize leftover area — tight packing |
| `worst-fit` | Maximize leftover area — sometimes reduces total waste by leaving bigger reusable offcuts |

#### Split rules (how to divide remaining space after placement)

| Rule | Effect |
|---|---|
| `shorter-axis` | Split along the shorter remaining dimension (generally best) |
| `longer-axis` | Split along the longer dimension |
| `horizontal-first` | Always split horizontally first |
| `vertical-first` | Always split vertically first |

#### Multi-strategy solver

`solveAll()` in `solver.ts` runs all 15 strategy combinations. For each:
1. Expand panels by quantity into individual pieces
2. Sort pieces by the strategy's `SortCriterion` (area, perimeter, longest-side, width, or height — all descending)
3. Pack onto sheets, opening a new sheet when no existing sheet fits the current piece
4. Return a `Solution` with total waste percentage

Results are sorted by `totalWaste` ascending — best layout is always index 0. The top 5 are shown as numbered pills; the rest are revealed via the "More Layouts" pill next to them.

#### Kerf

Added to each piece's packing footprint (`width + kerf`, `height + kerf`) but **not** stored in the placement record. Kerf compounds correctly: a row of 3 pieces each give back their right-edge kerf to the next available free rect.

#### Edge trim

Each `StockSheet` has `trimTop/Right/Bottom/Left` fields. Before packing, the usable rectangle is inset by these values. Default 0 — useful for sheets with rough-cut or damaged edges.

---

## State Management

Five Zustand stores with no circular dependencies. Stores access each other only at action time via `.getState()`:

| Store | Holds | Key actions |
|---|---|---|
| `useProjectStore` | name, stockSheets, panels, kerf, units | add/update/remove sheets & panels, setKerf, setUnits, getProjectData, loadProjectData |
| `useLayoutStore` | solutions[], activeSolutionIndex, revealedCount, isOptimizing | setSolutions, setActive, shuffleNext |
| `useDragStore` | `pinnedPieces: Set<string>` | togglePin, isPinned, clearPins |
| `useHistoryStore` | past[], future[] of `{solutions, activeSolutionIndex}` | pushState, undo, redo (max 50 entries) |
| `useViewStore` | showLabels, viewMode, showCutSequence, showEdgeDims, zoom | toggleLabels, setViewMode, toggleCutSequence, toggleEdgeDims, setZoom |

Undo history is pushed **before** every layout mutation (drag drop, rotate, re-optimize). Undo/redo is wired to Cmd+Z / Cmd+Shift+Z in `page.tsx`.

---

## Data Model

All dimension values are stored internally in **inches** regardless of the display unit. The `units` setting in `useProjectStore` only controls parsing and display — not storage. Projects are unit-agnostic at rest.

```typescript
StockSheet {
  id: string           // nanoid
  label: string        // e.g. "Sheet A" — shown in diagrams and PDF
  length: number       // inches (long dimension)
  width: number        // inches (short dimension)
  quantity: number     // how many identical sheets are available
  trimTop/Right/Bottom/Left: number  // edge trim in inches (default 0)
}

Panel {
  id: string
  label: string        // e.g. "Side Panel"
  length: number       // inches
  width: number        // inches
  quantity: number     // how many are needed
}

Placement {
  panelId: string      // references Panel.id
  label: string        // copied from Panel at placement time
  x, y: number         // top-left corner in inches from sheet origin
  width, height: number // as placed — may be swapped from Panel if rotated
  rotated: boolean
  pinned: boolean      // legacy; live pinning state is in useDragStore
  color: string        // hex, assigned by panel index from COLORS palette
}

SheetLayout {
  stockSheetId: string
  sheetIndex: number   // 0-based (for sheets with quantity > 1)
  placements: Placement[]
  cutSequence: CutStep[]
  wastePercent: number
  usedArea: number     // square inches
}

Solution {
  id: string
  strategyName: string
  sheets: SheetLayout[]
  totalWaste: number   // weighted average across all sheets
  totalSheets: number
  unplacedPanels: Panel[]  // panels that didn't fit on any sheet
}

CutStep {
  stepNumber: number
  orientation: 'horizontal' | 'vertical'
  x1, y1, x2, y2: number  // line endpoints in sheet-space inches
}

ProjectData {            // serialized to localStorage and .json files
  version: 1
  name: string
  stockSheets: StockSheet[]
  panels: Panel[]
  kerf: number
  savedAt: string        // ISO 8601
}
```

---

## Measurement System

**`src/lib/fractions.ts`** is the single source of truth for all parsing and display.

### Imperial mode
- **Input:** `parseDimension()` accepts fractions (`12 1/2`, `1/8`, `12-1/2`), mixed numbers, and plain decimals (`12.5`) transparently — no toggle needed, both formats always work
- **Display:** `formatDimension()` renders as fractions with 1/16" precision (`12 1/2"`, `3/4"`)
- **Kerf default:** 1/8" (0.125 in)
- **Stock presets:** 4×8', 5×5', 4×4', 2×4', 2×2'

### Metric mode
- **Input:** `parseMetric()` accepts plain numbers in mm (`317`, `3`)
- **Display:** `formatMetric()` renders as whole millimeters (`317 mm`); sub-millimeter values show one decimal (`0.8 mm`)
- **Kerf default:** 3 mm
- **Stock presets:** 2440×1220, 2500×1250, 1220×1220, 2440×610, 1220×610 mm

Switching units resets kerf to the new system's default. All previously entered dimensions remain correct since they're stored in inches. **Set the unit system before entering measurements.**

---

## Drag, Pin & Re-optimize

`SheetCanvas.tsx` handles all piece interaction using native SVG pointer events (no DnD library).

### Drag & drop
- `onPointerDown` on each SVG `<g>` captures the pointer and records offset within the piece
- `onPointerMove` calls `getSvgPoint()` (uses `svg.getScreenCTM().inverse()`) to convert screen → sheet-space coordinates, then `snapToEdges()` to snap within 8px screen-space of any piece edge or sheet boundary
- `onPointerUp` commits the move: saves undo state, writes new `x/y`, recalculates cut sequence, and auto-pins the piece

### Rotate
The ↺ button is shown on every piece. For pieces large enough to contain it (≥28px on screen) it sits in the bottom-left corner; for smaller pieces it floats just above the piece so it's always reachable. Clicking swaps `width`/`height`, re-centers the piece on its old center clamped to sheet bounds, toggles `rotated`, auto-pins, and recalculates cut sequence.

### Pinning
Pins are stored in `useDragStore.pinnedPieces` as a `Set<string>` with keys `"stockSheetId-sheetIndex:placementIndex"`. Pieces auto-pin on drag or rotate. An amber ⚓ badge appears on pinned pieces; clicking it unpins. "Release N" in the toolbar clears all pins.

### Re-Plan Cuts (`reoptimize.ts` — `reOptimizeAroundPinned`)
When the user clicks **Re-Plan Cuts** in the anchor banner:

1. Each sheet's pieces are split into **anchored** (pinned) and **floating** (unpinned)
2. **Pass 1 — anchored pieces:** Record each piece's center at pin time as `prefCX/prefCY`. Score all current free rects by distance from that preferred center. Place in the closest valid rect, clamped within it. Kerf is subtracted from free rects as `width+kerf × height+kerf` footprints.
3. **Pass 2 — floating pieces:** Best-fit (smallest area) into remaining free rects
4. Derive a fresh cut sequence from all new placements
5. Inject result as a new top solution; undo restores the prior state

**Pinning is a soft preference**, not a hard coordinate lock. A piece may shift by up to the kerf width if the exact position is unavailable. This is intentional — it accommodates kerf spacing naturally.

---

## Cut Sequence

`reoptimize.ts` — `deriveCutSequenceFromPlacements()`

Cut sequence is derived from placement geometry using a **recursive guillotine approach** that models how a woodworker actually sequences cuts — isolating waste first, then separating pieces within each sub-region.

### Algorithm

At each region, the algorithm:

1. Collects all four edges of every piece as candidate cut positions (top, bottom, left, right)
2. Filters out any position where a piece would be split (straddle check with 0.05" tolerance)
3. Scores each valid cut:
   - **Waste-isolation cut** (one side has no pieces): `0.8 + wasteRatio × 0.2` (scores 0.8–1.0)
   - **Piece-separating cut**: `alignmentFrac × 0.5 + balance × 0.3 + 0.2` (scores 0.2–1.0)
   - `alignmentFrac` = fraction of pieces with an edge at this cut position (±0.25")
   - `balance` = `min(n1, n2) / max(n1, n2)` — how evenly the cut splits the group
4. Emits the highest-scoring cut, then **recurses independently** into each sub-region

This means: when a large unused zone exists (e.g., pieces clustered in the left 30% of a sheet), the algorithm cuts off the waste strip first, then works within the piece zone — matching natural woodworking practice. It runs on every Optimize, drag-drop, and rotate. The result renders as red dashed lines with numbered badges when **Cuts** is on in the toolbar.

---

## Export

### PDF (`src/lib/export/pdf.ts`)
jsPDF, landscape letter (11 × 8.5"), entirely client-side.

**Page 1 — Summary**
- Project name, sheets used, total waste, unplaced panel warning (if any)
- Panels needed table: label, length, width, qty — matches the sidebar input

**Pages 2+ — One per sheet**
- Header: sheet number, label, dimensions, waste %
- Diagram: scaled layout; piece fills are color-tinted (38% panel color + 62% white) for print legibility; cut-list index number in each piece's top-left corner
- Cut list: numbered table of all placements on that sheet (label, length, width, rotated?)
- Footer: project name + page X of N — so sheets stay identifiable if separated in the shop

All dimensions use the active unit setting (imperial fractions or metric mm).

### PNG (`src/lib/export/image.ts`)
`html-to-image` captures the `[data-export-target]` div (the diagram scroll area) as a PNG file.

---

## Persistence

### Auto-save
`useAutoSave` subscribes to `useProjectStore` and calls `saveToLocalStorage()` on every change. On first mount it loads from localStorage to restore the previous session.
Storage key: `cut-planner-project`

### Manual save/load
`ProjectMenu` provides:
- **Save to file:** `exportProjectToFile()` — creates a `<a download>` for a `.json` file
- **Load from file:** `importProjectFromFile()` — opens a file picker, parses JSON, validates `version: 1`, loads into the store

### Format stability
`ProjectData` (version: 1) stores all dimensions as plain numbers in inches. A project saved in imperial displays correctly in metric. The `version` field is checked on load — future breaking changes should increment it and include a migration path.

---

## UI / Design System

`src/app/globals.css` defines the design tokens:

```css
:root {
  --primary:  oklch(0.511 0.231 264);  /* indigo-600 */
  --sidebar:  oklch(0.975 0.012 264);  /* light indigo-tinted white */
  --radius:   0.625rem;
}
```

Custom classes:
- `.section-header` — small-caps, indigo left-border accent
- `.form-card` — white bordered card with hover highlight
- `.field-label` — uppercase gray label above inputs
- `.btn-optimize` — amber → orange gradient CTA

### shadcn/ui v4 / base-ui
shadcn v4 uses **base-ui** instead of Radix. The critical difference — composition uses the `render=` prop, not `asChild`:

```tsx
// ✅ Correct for shadcn v4 / base-ui
<DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>

// ❌ Will not compile — asChild does not exist in base-ui
<DropdownMenuTrigger asChild><Button /></DropdownMenuTrigger>
```

### Colors
`src/lib/colors.ts` — `getColor(panelIndex)` returns a deterministic hex color from a 20-color palette. The same index always returns the same color, so the sidebar swatch, SVG diagram, and PDF all stay in sync.

---

## Local Development

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/stevescher/cut-planner.git
cd cut-planner
npm install
npm run dev       # http://localhost:3000
```

### Sample projects

`samples/` contains five ready-made `.json` files for testing different packing and cut scenarios:

| File | Description |
|---|---|
| `sample-a.json` | 4 same-height parts clustered in the left of a 4×8 sheet |
| `sample-b.json` | Mixed-height narrow parts |
| `sample-c.json` | Parts filling roughly half the sheet |
| `sample-d.json` | Parts spanning nearly the full width |
| `sample-e.json` | Many small parts of multiple sizes |

Load any of them via **Project → Load from file**.

### Production build
```bash
npm run build     # next build --webpack
npm start
```

> Do **not** use Turbopack (`--turbo`) for production builds — it fails on Vercel's Linux x64 environment. Turbopack is fine for `npm run dev` locally.

### Lint
```bash
npm run lint
```

---

## Deployment

**Platform:** Vercel
**Team:** `steve-schers-projects`
**Project ID:** `prj_KYdMjKHF14jbUf2DoNTI2LJRRAsH`
**Config:** `.vercel/project.json` (checked in — do not delete or regenerate)

### Auto-deploy
Every push to `main` triggers a Vercel production deployment automatically via the GitHub → Vercel integration.
URL: **[cutplanner.stevescher.com](https://cutplanner.stevescher.com)**

### Manual deploy
```bash
npx vercel deploy --prod --yes
```

### Environment variables
**None required.** The app is 100% client-side — no API routes, no database, no server secrets. All computation (optimization, export) runs in the browser.

### Build configuration
Vercel reads the `build` script from `package.json`:
```json
"build": "next build --webpack"
```

---

## Known Limitations & Future Work

### Current limitations

**No Web Worker:** `solveAll()` runs on the main thread inside a `setTimeout(fn, 50)` to allow one React render cycle for the loading state. For typical projects (≤50 panels) this is fast enough (<150ms). Very large projects could briefly freeze the UI. The `comlink` package is already installed — a worker implementation is straightforward.

**Guillotine constraint after manual edits:** The initial optimizer produces guillotine-valid layouts. After drag/rotate/re-optimize, placements may no longer be guillotine-valid — they are free-rectangle repacked instead. The cut sequence remains a good approximation (derived from piece edges) but is not a strict guillotine tree traversal.

**localStorage only:** Project data is lost if the browser's localStorage is cleared. The manual JSON export/import workflow mitigates this.

**No grain direction:** Sheet orientation is not tracked. Pieces rotate freely unless a no-rotation strategy wins.

### Planned additions

| Feature | Notes |
|---|---|
| **Web Worker** | Move `solveAll()` off-thread via `comlink` (already installed) |
| **Material pricing** | Cost per sheet type → total material estimate |
| **User accounts + cloud save** | Projects saved server-side; `localStorage` as fallback |
| **Remnant tracking** | Mark offcuts as new stock sheets for future projects |
| **CSV/Excel import** | Bulk panel entry from a spreadsheet |
| **Edge banding** | Tag which panel edges need banding; surface in the cut list |
| **Grain / face direction** | Constrain rotation for grain-matched assemblies |
