import { ProjectData } from './optimizer/types';
import { safeFilename } from './safe-export';

const STORAGE_KEY = 'cut-planner-project';

/** Current on-disk schema version. Bump when the shape changes and add a
 *  migration step in migrateProjectData below. */
const CURRENT_VERSION = 1 as const;

const MAX_DIMENSION = 10_000; // inches — no realistic sheet exceeds this

function isFinitePositive(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v) && v > 0;
}

function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v) && v >= 0;
}

function validateProjectData(data: unknown): data is ProjectData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  // Accept the current version or any older version we know how to migrate.
  // A newer version (saved by a future build) is rejected rather than trusted.
  if (typeof d.version !== 'number' || d.version < 1 || d.version > CURRENT_VERSION) return false;
  if (typeof d.name !== 'string' || d.name.length > 200) return false;
  if (typeof d.savedAt !== 'string') return false;
  if (!isFiniteNonNegative(d.kerf) || (d.kerf as number) > 1) return false;

  if (!Array.isArray(d.stockSheets) || d.stockSheets.length > 50) return false;
  for (const s of d.stockSheets) {
    if (!s || typeof s !== 'object') return false;
    const sheet = s as Record<string, unknown>;
    if (typeof sheet.id !== 'string') return false;
    if (typeof sheet.label !== 'string' || sheet.label.length > 200) return false;
    if (!isFinitePositive(sheet.length) || (sheet.length as number) > MAX_DIMENSION) return false;
    if (!isFinitePositive(sheet.width) || (sheet.width as number) > MAX_DIMENSION) return false;
    if (!Number.isInteger(sheet.quantity) || (sheet.quantity as number) < 1 || (sheet.quantity as number) > 100) return false;
    for (const trim of ['trimTop', 'trimRight', 'trimBottom', 'trimLeft']) {
      if (!isFiniteNonNegative(sheet[trim]) || (sheet[trim] as number) > MAX_DIMENSION) return false;
    }
    // pricePerSheet is optional; reject only a wrong type or an out-of-range value.
    if (sheet.pricePerSheet !== undefined &&
        (!isFiniteNonNegative(sheet.pricePerSheet) || (sheet.pricePerSheet as number) > 1_000_000)) return false;
    // grainDirection is optional; accept only the two known values.
    if (sheet.grainDirection !== undefined &&
        sheet.grainDirection !== 'length' && sheet.grainDirection !== 'width') return false;
  }

  // Accept missing units for backwards compatibility with pre-units saves; default to 'imperial'
  if (d.units !== undefined && d.units !== 'imperial' && d.units !== 'metric') return false;

  if (!Array.isArray(d.panels) || d.panels.length > 200) return false;
  for (const p of d.panels) {
    if (!p || typeof p !== 'object') return false;
    const panel = p as Record<string, unknown>;
    if (typeof panel.id !== 'string') return false;
    if (typeof panel.label !== 'string' || panel.label.length > 200) return false;
    if (!isFinitePositive(panel.length) || (panel.length as number) > MAX_DIMENSION) return false;
    if (!isFinitePositive(panel.width) || (panel.width as number) > MAX_DIMENSION) return false;
    if (!Number.isInteger(panel.quantity) || (panel.quantity as number) < 1 || (panel.quantity as number) > 100) return false;
    // lockRotation is optional (backfilled on load); reject only a wrong type.
    if (panel.lockRotation !== undefined && typeof panel.lockRotation !== 'boolean') return false;
  }

  return true;
}

/**
 * Persist the project. Returns true on success, false if the write failed
 * (quota exceeded, private-mode Safari, storage disabled) so callers can warn
 * the user that autosave stopped working instead of silently losing data.
 */
export function saveToLocalStorage(data: ProjectData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
    return false;
  }
}

/**
 * Bring a validated (current-or-older) project up to the current schema:
 * backfill fields that newer versions added, then stamp the current version.
 */
function migrateProjectData(data: ProjectData): ProjectData {
  return {
    ...data,
    version: CURRENT_VERSION,
    units: data.units ?? 'imperial',
    panels: data.panels.map((p) => ({ ...p, lockRotation: p.lockRotation ?? false })),
  };
}

export function loadFromLocalStorage(): ProjectData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!validateProjectData(data)) return null;
    return migrateProjectData(data);
  } catch {
    return null;
  }
}

export function exportProjectToFile(data: ProjectData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(data.name, 'cut-planner-project')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importProjectFromFile(): Promise<ProjectData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
      if (file.size > MAX_FILE_SIZE) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        const data: unknown = JSON.parse(text);
        if (!validateProjectData(data)) {
          resolve(null);
          return;
        }
        resolve(migrateProjectData(data));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
