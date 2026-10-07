import { SheetGrain, StockSheet } from './optimizer/types';

/** A sheet material whose usual grain pre-fills the sheet's grain setting. */
export interface MaterialPreset {
  id: string;
  name: string;
  /** Grained materials run their face grain along the sheet length; the rest have none. */
  grained: boolean;
}

export const MATERIAL_PRESETS: readonly MaterialPreset[] = [
  { id: 'veneer-ply', name: 'Veneered plywood', grained: true },
  { id: 'baltic-birch', name: 'Baltic birch plywood', grained: true },
  { id: 'woodgrain-melamine', name: 'Woodgrain melamine / TFL', grained: true },
  { id: 'mdf', name: 'MDF', grained: false },
  { id: 'particleboard', name: 'Particleboard', grained: false },
  { id: 'solid-melamine', name: 'Solid-color melamine', grained: false },
  { id: 'hardboard', name: 'Hardboard', grained: false },
];

export const MATERIAL_IDS: readonly string[] = MATERIAL_PRESETS.map((m) => m.id);

export function findMaterial(id: string | undefined): MaterialPreset | undefined {
  return MATERIAL_PRESETS.find((m) => m.id === id);
}

const isSquare = (s: Pick<StockSheet, 'length' | 'width'>) => s.length > 0 && s.length === s.width;

/**
 * Sheet updates for choosing a material (or `undefined` to clear it).
 *
 * - Grain: a grained material sets grain along the length, a grainless one
 *   sets none. On a square sheet a grained material clears the grain instead:
 *   no source says which edge the face grain parallels on, say, 5x5 Baltic
 *   birch, so the user must choose (see needsGrainChoice).
 * - Label: filled with the material name when the sheet has no label, or
 *   still carries the previous material's name; a label the user typed stays.
 */
export function materialUpdates(
  sheet: Pick<StockSheet, 'length' | 'width' | 'label' | 'material'>,
  materialId: string | undefined,
): Partial<StockSheet> {
  const material = findMaterial(materialId);
  const previousName = findMaterial(sheet.material)?.name;
  const labelIsAuto = !sheet.label.trim() || sheet.label === previousName;
  if (!material) return labelIsAuto && previousName ? { material: undefined, label: '' } : { material: undefined };
  const updates: Partial<StockSheet> = { material: material.id };
  updates.grainDirection = (material.grained && !isSquare(sheet) ? 'length' : 'none') satisfies SheetGrain;
  if (labelIsAuto) updates.label = material.name;
  return updates;
}

/** True when a square sheet of a grained material still has no grain direction chosen. */
export function needsGrainChoice(sheet: Pick<StockSheet, 'length' | 'width' | 'grainDirection' | 'material'>): boolean {
  return !!findMaterial(sheet.material)?.grained && isSquare(sheet) && sheet.grainDirection === 'none';
}

/**
 * Sheet updates for a size change, for a sheet of a grained material:
 * - becoming square clears its grain direction (often filled in by the preset
 *   while it was rectangular), so the user must choose which edge it parallels;
 * - becoming rectangular with no grain set restores the material's default,
 *   grain along the length, so a resize never silently drops the grain rule.
 */
export function dimensionUpdates(
  sheet: Pick<StockSheet, 'length' | 'width' | 'material' | 'grainDirection'>,
  size: { length?: number; width?: number },
): Partial<StockSheet> {
  if (!findMaterial(sheet.material)?.grained) return { ...size };
  const next = { length: size.length ?? sheet.length, width: size.width ?? sheet.width };
  const wasSquare = isSquare(sheet);
  const nowSquare = isSquare(next);
  if (nowSquare && !wasSquare) return { ...size, grainDirection: 'none' };
  if (!nowSquare && wasSquare && sheet.grainDirection === 'none') return { ...size, grainDirection: 'length' };
  return { ...size };
}
