/** A stock sheet definition from user input */
export interface StockSheet {
  id: string;
  label: string;
  material: string;
  length: number; // inches
  width: number; // inches
  quantity: number;
  trimTop: number;
  trimRight: number;
  trimBottom: number;
  trimLeft: number;
}

/** A required panel/part from user input */
export interface Panel {
  id: string;
  label: string;
  length: number; // inches
  width: number; // inches
  quantity: number;
}

/** A panel placed on a specific sheet */
export interface Placement {
  panelId: string;
  label: string;
  x: number;
  y: number;
  width: number; // as placed (may be rotated)
  height: number; // as placed (may be rotated)
  rotated: boolean;
  pinned: boolean;
  color: string;
}

/** A single cut step in the cutting sequence */
export interface CutStep {
  stepNumber: number;
  orientation: 'horizontal' | 'vertical';
  /** Position along the cut axis (absolute coordinate on the sheet) */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** One stock sheet with its assigned placements */
export interface SheetLayout {
  stockSheetId: string;
  sheetIndex: number;
  placements: Placement[];
  cutSequence: CutStep[];
  wastePercent: number;
  usedArea: number;
}

/** A complete solution across all sheets */
export interface Solution {
  id: string;
  strategyName: string;
  sheets: SheetLayout[];
  totalWaste: number;
  totalSheets: number;
  unplacedPanels: Panel[];
}

/** Guillotine tree node — represents recursive splits */
export interface GuillotineNode {
  x: number;
  y: number;
  width: number;
  height: number;
  split: 'horizontal' | 'vertical' | null;
  placement: Placement | null;
  children: [GuillotineNode, GuillotineNode] | null;
}

export type SortCriterion =
  | 'area-desc'
  | 'perimeter-desc'
  | 'longest-side-desc'
  | 'width-desc'
  | 'height-desc';

export type SplitRule =
  | 'shorter-axis'
  | 'longer-axis'
  | 'horizontal-first'
  | 'vertical-first';

export type SelectionRule =
  | 'best-short-side-fit'
  | 'best-long-side-fit'
  | 'best-area-fit'
  | 'worst-fit';

export interface PackingStrategy {
  name: string;
  sort: SortCriterion;
  splitRule: SplitRule;
  selectionRule: SelectionRule;
  allowRotation: boolean;
}

/** Configuration passed to optimizer */
export interface OptimizerConfig {
  stockSheets: StockSheet[];
  panels: Panel[];
  kerf: number;
  pinnedPlacements: Record<string, Placement[]>;
  strategy: PackingStrategy;
}

/** Common stock sheet preset */
export interface StockPreset {
  label: string;
  length: number;
  width: number;
}

export const STOCK_PRESETS: StockPreset[] = [
  { label: "4' × 8' (48 × 96)", length: 96, width: 48 },
  { label: "5' × 5' (60 × 60)", length: 60, width: 60 },
  { label: "4' × 4' (48 × 48)", length: 48, width: 48 },
  { label: "2' × 4' (24 × 48)", length: 48, width: 24 },
  { label: "2' × 2' (24 × 24)", length: 24, width: 24 },
];

/** Serializable project data for save/load */
export interface ProjectData {
  version: 1;
  name: string;
  stockSheets: StockSheet[];
  panels: Panel[];
  kerf: number;
  savedAt: string;
}
