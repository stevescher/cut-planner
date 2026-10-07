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
    version: 2,
    name: 'Test',
    stockSheets: [
      { id: 's1', label: '', length: 96, width: 48, quantity: 1, trimTop: 0, trimRight: 0, trimBottom: 0, trimLeft: 0, grainDirection: 'none' },
    ],
    panels: [
      { id: 'p1', label: 'A', length: 24, width: 12, quantity: 2, grain: 'follow' },
    ],
    kerf: 0.125,
    units: 'imperial',
    cutPreference: 'auto',
    grainGroups: [],
    savedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A project as v1 saved it: optional grainDirection, panel lockRotation, no cutPreference. */
function v1Project(): Record<string, unknown> & { stockSheets: Record<string, unknown>[]; panels: Record<string, unknown>[] } {
  return {
    version: 1,
    name: 'Old',
    stockSheets: [
      { id: 's1', label: '', length: 96, width: 48, quantity: 1, trimTop: 0, trimRight: 0, trimBottom: 0, trimLeft: 0 },
    ],
    panels: [
      { id: 'p1', label: 'A', length: 24, width: 12, quantity: 2, lockRotation: true },
      { id: 'p2', label: 'B', length: 24, width: 12, quantity: 1, lockRotation: false },
      { id: 'p3', label: 'C', length: 24, width: 12, quantity: 1 },
    ],
    kerf: 0.125,
    units: 'imperial',
    savedAt: '2026-01-01T00:00:00.000Z',
  };
}

function store(data: unknown) {
  localStorage.setItem('cut-planner-project', JSON.stringify(data));
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

  it('rejects a project saved by a newer schema version', () => {
    store(baseProject({ version: 99 as 2 }));
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('rejects an out-of-range quantity', () => {
    const p = baseProject();
    p.panels[0].quantity = 9999;
    localStorage.setItem('cut-planner-project', JSON.stringify(p));
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('round-trips sheet grain, panel grain and cut preference', () => {
    const p = baseProject({ cutPreference: 'always-rip' });
    p.stockSheets[0].grainDirection = 'width';
    p.panels[0].grain = 'across';
    store(p);
    const loaded = loadFromLocalStorage();
    expect(loaded?.stockSheets[0].grainDirection).toBe('width');
    expect(loaded?.panels[0].grain).toBe('across');
    expect(loaded?.cutPreference).toBe('always-rip');
  });

  it('rejects an unknown grainDirection value', () => {
    const p = baseProject();
    (p.stockSheets[0] as unknown as Record<string, unknown>).grainDirection = 'diagonal';
    store(p);
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('rejects an unknown panel grain value', () => {
    const p = baseProject();
    (p.panels[0] as unknown as Record<string, unknown>).grain = 'sideways';
    store(p);
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('rejects an unknown cut preference', () => {
    store({ ...baseProject(), cutPreference: 'diagonal-first' });
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

  it('defaults a v2 sheet with no grainDirection to none', () => {
    const p = baseProject();
    delete (p.stockSheets[0] as unknown as Record<string, unknown>).grainDirection;
    store(p);
    expect(loadFromLocalStorage()?.stockSheets[0].grainDirection).toBe('none');
  });
});

describe('v1 to v2 migration', () => {
  it('keeps an unset v1 sheet grain as along the length, as v1 treated it', () => {
    store(v1Project());
    const loaded = loadFromLocalStorage();
    expect(loaded?.version).toBe(2);
    expect(loaded?.stockSheets[0].grainDirection).toBe('length');
  });

  it('maps lockRotation true to follow, and false or missing to any', () => {
    store(v1Project());
    const panels = loadFromLocalStorage()!.panels;
    expect(panels.map((p) => p.grain)).toEqual(['follow', 'any', 'any']);
    expect(panels.every((p) => !('lockRotation' in p))).toBe(true);
  });

  it('defaults the cut preference to auto', () => {
    store(v1Project());
    expect(loadFromLocalStorage()?.cutPreference).toBe('auto');
  });

  it('keeps an explicit v1 width grain', () => {
    const p = v1Project();
    p.stockSheets[0].grainDirection = 'width';
    store(p);
    expect(loadFromLocalStorage()?.stockSheets[0].grainDirection).toBe('width');
  });

  it("rejects 'none' grain in a v1 file, which v1 never wrote", () => {
    const p = v1Project();
    p.stockSheets[0].grainDirection = 'none';
    store(p);
    expect(loadFromLocalStorage()).toBeNull();
  });

  it('rejects a non-boolean lockRotation', () => {
    const p = v1Project();
    p.panels[0].lockRotation = 'yes';
    store(p);
    expect(loadFromLocalStorage()).toBeNull();
  });
});
