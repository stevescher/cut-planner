import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
} from '@/lib/project-io';
import { ProjectData } from '@/lib/optimizer/types';

// Minimal in-memory localStorage for the node test env.
function installLocalStorage(impl?: Partial<Storage>) {
  const store = new Map<string, string>();
  const ls: Storage = {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
    ...impl,
  };
  vi.stubGlobal('localStorage', ls);
  return store;
}

function baseProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    version: 1,
    name: 'Test',
    stockSheets: [
      { id: 's1', label: '', length: 96, width: 48, quantity: 1, trimTop: 0, trimRight: 0, trimBottom: 0, trimLeft: 0 },
    ],
    panels: [
      { id: 'p1', label: 'A', length: 24, width: 12, quantity: 2, lockRotation: false },
    ],
    kerf: 0.125,
    units: 'imperial',
    savedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  installLocalStorage();
});

describe('saveToLocalStorage', () => {
  it('returns true on success and round-trips', () => {
    expect(saveToLocalStorage(baseProject())).toBe(true);
    const loaded = loadFromLocalStorage();
    expect(loaded?.name).toBe('Test');
  });

  it('returns false when the write throws (quota / disabled)', () => {
    installLocalStorage({
      setItem: () => { throw new DOMException('QuotaExceededError'); },
    });
    expect(saveToLocalStorage(baseProject())).toBe(false);
  });
});

describe('loadFromLocalStorage validation + migration', () => {
  it('backfills a missing units field to imperial', () => {
    const p = baseProject();
    delete (p as unknown as Record<string, unknown>).units;
    localStorage.setItem('cut-planner-project', JSON.stringify(p));
    expect(loadFromLocalStorage()?.units).toBe('imperial');
  });

  it('backfills a missing lockRotation on panels to false', () => {
    const p = baseProject();
    delete (p.panels[0] as unknown as Record<string, unknown>).lockRotation;
    localStorage.setItem('cut-planner-project', JSON.stringify(p));
    expect(loadFromLocalStorage()?.panels[0].lockRotation).toBe(false);
  });

  it('rejects a project saved by a newer schema version', () => {
    localStorage.setItem('cut-planner-project', JSON.stringify(baseProject({ version: 99 as 1 })));
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('rejects a non-boolean lockRotation', () => {
    const p = baseProject();
    (p.panels[0] as unknown as Record<string, unknown>).lockRotation = 'yes';
    localStorage.setItem('cut-planner-project', JSON.stringify(p));
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('rejects an out-of-range quantity', () => {
    const p = baseProject();
    p.panels[0].quantity = 9999;
    localStorage.setItem('cut-planner-project', JSON.stringify(p));
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('round-trips an optional grainDirection on a stock sheet', () => {
    const p = baseProject();
    p.stockSheets[0].grainDirection = 'width';
    localStorage.setItem('cut-planner-project', JSON.stringify(p));
    expect(loadFromLocalStorage()?.stockSheets[0].grainDirection).toBe('width');
  });

  it('accepts a stock sheet with no grainDirection (optional)', () => {
    expect(saveToLocalStorage(baseProject())).toBe(true);
    expect(loadFromLocalStorage()?.stockSheets[0].grainDirection).toBeUndefined();
  });

  it('rejects an unknown grainDirection value', () => {
    const p = baseProject();
    (p.stockSheets[0] as unknown as Record<string, unknown>).grainDirection = 'diagonal';
    localStorage.setItem('cut-planner-project', JSON.stringify(p));
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('round-trips an optional pricePerSheet and rejects an out-of-range one', () => {
    const p = baseProject();
    p.stockSheets[0].pricePerSheet = 42.5;
    localStorage.setItem('cut-planner-project', JSON.stringify(p));
    expect(loadFromLocalStorage()?.stockSheets[0].pricePerSheet).toBe(42.5);

    const bad = baseProject();
    (bad.stockSheets[0] as unknown as Record<string, unknown>).pricePerSheet = 2_000_000;
    localStorage.setItem('cut-planner-project', JSON.stringify(bad));
    expect(loadFromLocalStorage()).toBeNull();
  });
});
