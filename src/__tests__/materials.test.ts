import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MATERIAL_PRESETS, dimensionUpdates, materialUpdates, needsGrainChoice } from '@/lib/materials';
import { loadFromLocalStorage } from '@/lib/project-io';

const rect = { length: 96, width: 48, label: '', material: undefined as string | undefined };
const square = { length: 60, width: 60, label: '', material: undefined as string | undefined };

describe('materialUpdates', () => {
  it('sets grain along the length for a grained material', () => {
    expect(materialUpdates(rect, 'veneer-ply')).toEqual({ material: 'veneer-ply', grainDirection: 'length', label: 'Veneered plywood' });
  });

  it('sets no grain for a grainless material', () => {
    expect(materialUpdates(rect, 'mdf')).toMatchObject({ material: 'mdf', grainDirection: 'none' });
  });

  it('clears grain for a grained material on a square sheet, so the user chooses', () => {
    expect(materialUpdates(square, 'baltic-birch')).toEqual({
      material: 'baltic-birch', grainDirection: 'none', label: 'Baltic birch plywood',
    });
  });

  it('still sets no grain for a grainless material on a square sheet', () => {
    expect(materialUpdates(square, 'hardboard').grainDirection).toBe('none');
  });

  it('keeps a label the user typed', () => {
    expect(materialUpdates({ ...rect, label: 'Cabinet sides' }, 'veneer-ply').label).toBeUndefined();
  });

  it("replaces the previous material's auto-filled label when switching", () => {
    const sheet = { ...rect, label: 'MDF', material: 'mdf' };
    expect(materialUpdates(sheet, 'particleboard').label).toBe('Particleboard');
  });

  it('clears the material, and its auto-filled label, for Other', () => {
    expect(materialUpdates({ ...rect, label: 'MDF', material: 'mdf' }, undefined)).toEqual({ material: undefined, label: '' });
    expect(materialUpdates({ ...rect, label: 'Shop ply', material: 'mdf' }, undefined)).toEqual({ material: undefined });
  });

  it('ignores an unknown id', () => {
    expect(materialUpdates(rect, 'unobtainium')).toEqual({ material: undefined });
  });

  it('covers both grained and grainless materials', () => {
    expect(MATERIAL_PRESETS.some((m) => m.grained)).toBe(true);
    expect(MATERIAL_PRESETS.some((m) => !m.grained)).toBe(true);
  });
});

describe('dimensionUpdates', () => {
  it('clears an inherited grain when a grained-material sheet becomes square', () => {
    const sheet = { length: 96, width: 48, material: 'veneer-ply', grainDirection: 'length' as const };
    expect(dimensionUpdates(sheet, { length: 60, width: 60 })).toEqual({ length: 60, width: 60, grainDirection: 'none' });
    expect(dimensionUpdates(sheet, { length: 48 }).grainDirection).toBe('none');
  });

  it('restores grain along the length when a grained square sheet with no grain becomes rectangular', () => {
    expect(dimensionUpdates({ length: 60, width: 60, material: 'veneer-ply', grainDirection: 'none' }, { length: 96 }))
      .toEqual({ length: 96, grainDirection: 'length' });
  });

  it('keeps a direction the user chose on a square sheet when it becomes rectangular', () => {
    expect(dimensionUpdates({ length: 60, width: 60, material: 'veneer-ply', grainDirection: 'width' }, { length: 96 }))
      .toEqual({ length: 96 });
  });

  it('leaves grain alone otherwise', () => {
    expect(dimensionUpdates({ length: 96, width: 48, material: 'mdf', grainDirection: 'none' }, { length: 48 })).toEqual({ length: 48 });
    expect(dimensionUpdates({ length: 96, width: 48, material: undefined, grainDirection: 'length' }, { length: 48 })).toEqual({ length: 48 });
    expect(dimensionUpdates({ length: 60, width: 60, material: 'veneer-ply', grainDirection: 'none' }, { length: 60 })).toEqual({ length: 60 });
    expect(dimensionUpdates({ length: 96, width: 48, material: 'veneer-ply', grainDirection: 'length' }, { length: 120 })).toEqual({ length: 120 });
  });
});

describe('needsGrainChoice', () => {
  it('flags a square grained sheet with no grain chosen', () => {
    expect(needsGrainChoice({ ...square, material: 'baltic-birch', grainDirection: 'none' })).toBe(true);
  });

  it('clears once a direction is chosen, and never flags rectangles or grainless materials', () => {
    expect(needsGrainChoice({ ...square, material: 'baltic-birch', grainDirection: 'width' })).toBe(false);
    expect(needsGrainChoice({ ...rect, material: 'baltic-birch', grainDirection: 'none' })).toBe(false);
    expect(needsGrainChoice({ ...square, material: 'mdf', grainDirection: 'none' })).toBe(false);
  });
});

describe('project file material', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  const project = (material: unknown) => ({
    version: 2, name: 'P', savedAt: '2026-01-01T00:00:00Z', kerf: 0.125, units: 'imperial',
    cutPreference: 'auto', grainGroups: [], panels: [],
    stockSheets: [{ id: 's1', label: '', length: 96, width: 48, quantity: 1, trimTop: 0, trimRight: 0, trimBottom: 0, trimLeft: 0, grainDirection: 'length', material }],
  });

  it('round-trips a known material', () => {
    localStorage.setItem('cut-planner-project', JSON.stringify(project('veneer-ply')));
    expect(loadFromLocalStorage()?.stockSheets[0].material).toBe('veneer-ply');
  });

  it('rejects an unknown material', () => {
    localStorage.setItem('cut-planner-project', JSON.stringify(project('unobtainium')));
    expect(loadFromLocalStorage()).toBeNull();
  });
});
