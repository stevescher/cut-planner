import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { StockSheet, Panel, ProjectData, CutPreference, GrainGroup } from '@/lib/optimizer/types';
import { Units } from '@/lib/fractions';

interface ProjectState {
  projectName: string;
  stockSheets: StockSheet[];
  panels: Panel[];
  kerf: number;
  units: Units;
  cutPreference: CutPreference;
  grainGroups: GrainGroup[];

  setProjectName: (name: string) => void;
  setKerf: (kerf: number) => void;
  setCutPreference: (pref: CutPreference) => void;
  setUnits: (units: Units) => void;

  addStockSheet: (sheet?: Partial<StockSheet>) => void;
  updateStockSheet: (id: string, updates: Partial<StockSheet>) => void;
  removeStockSheet: (id: string) => void;

  addPanel: (panel?: Partial<Panel>) => void;
  updatePanel: (id: string, updates: Partial<Panel>) => void;
  removePanel: (id: string) => void;
  /** Replace the whole panel list in one write (used by bulk CSV import). */
  setPanels: (panels: Panel[]) => void;

  /** Create a grain-matched group, optionally adding a panel to it. Returns its id. */
  addGrainGroup: (firstPanelId?: string) => string;
  updateGrainGroup: (id: string, updates: Partial<Omit<GrainGroup, 'id'>>) => void;
  /** Delete a group; its panels stay, ungrouped. */
  removeGrainGroup: (id: string) => void;
  /** Put a panel in a group (or none). Joining adopts the group's grain setting. */
  setPanelGroup: (panelId: string, groupId: string | undefined) => void;

  getProjectData: () => ProjectData;
  loadProjectData: (data: ProjectData) => void;
  reset: () => void;
}

function createDefaultStockSheet(overrides?: Partial<StockSheet>): StockSheet {
  return {
    id: nanoid(),
    label: '',
    length: 96,
    width: 48,
    quantity: 1,
    trimTop: 0,
    trimRight: 0,
    trimBottom: 0,
    trimLeft: 0,
    // Grainless until the user says otherwise: forcing grain onto MDF and
    // hidden parts is the top complaint about cut-list optimizers.
    grainDirection: 'none',
    ...overrides,
  };
}

function createDefaultPanel(overrides?: Partial<Panel>): Panel {
  return {
    id: nanoid(),
    label: '',
    length: 0,
    width: 0,
    quantity: 1,
    grain: 'follow',
    ...overrides,
  };
}

/** Drop groups no panel belongs to any more. */
function pruneGroups(groups: GrainGroup[], panels: Panel[]): GrainGroup[] {
  const used = new Set(panels.map((p) => p.grainGroup).filter(Boolean));
  return groups.filter((g) => used.has(g.id));
}

/** Next unused "Group A", "Group B", ... name. */
function nextGroupName(groups: GrainGroup[]): string {
  const taken = new Set(groups.map((g) => g.name));
  for (let i = 0; i < 26 * 4; i++) {
    const letter = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26) + 1) : '');
    const name = `Group ${letter}`;
    if (!taken.has(name)) return name;
  }
  return `Group ${groups.length + 1}`;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: 'Untitled Project',
  stockSheets: [createDefaultStockSheet()],
  panels: [createDefaultPanel()],
  kerf: 0.125, // 1/8 inch
  units: 'imperial' as Units,
  cutPreference: 'auto' as CutPreference,
  grainGroups: [],

  setProjectName: (name) => set({ projectName: name }),
  setKerf: (kerf) => set({ kerf }),
  setCutPreference: (cutPreference) => set({ cutPreference }),
  setUnits: (units) => set({ units }),

  addStockSheet: (sheet) =>
    set((state) => ({
      stockSheets: [...state.stockSheets, createDefaultStockSheet(sheet)],
    })),

  updateStockSheet: (id, updates) =>
    set((state) => ({
      stockSheets: state.stockSheets.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  removeStockSheet: (id) =>
    set((state) => ({
      stockSheets: state.stockSheets.filter((s) => s.id !== id),
    })),

  addPanel: (panel) =>
    set((state) => ({
      panels: [...state.panels, createDefaultPanel(panel)],
    })),

  updatePanel: (id, updates) =>
    set((state) => {
      // A group's parts share one grain setting, so a grain change on one
      // member applies to the whole group.
      const target = state.panels.find((p) => p.id === id);
      const groupId = updates.grain !== undefined ? target?.grainGroup : undefined;
      return {
        panels: state.panels.map((p) => {
          if (p.id === id) return { ...p, ...updates };
          if (groupId && p.grainGroup === groupId) return { ...p, grain: updates.grain! };
          return p;
        }),
      };
    }),

  removePanel: (id) =>
    set((state) => {
      const panels = state.panels.filter((p) => p.id !== id);
      return { panels, grainGroups: pruneGroups(state.grainGroups, panels) };
    }),

  setPanels: (panels) => set((state) => ({ panels, grainGroups: pruneGroups(state.grainGroups, panels) })),

  addGrainGroup: (firstPanelId) => {
    const group: GrainGroup = { id: nanoid(), name: nextGroupName(get().grainGroups), arrangement: 'stack' };
    set((state) => {
      const panels = state.panels.map((p) => (p.id === firstPanelId ? { ...p, grainGroup: group.id } : p));
      // Moving a group's only member into the new group leaves the old one
      // empty; prune it, but keep the new group even before it has members.
      const kept = pruneGroups(state.grainGroups, panels);
      return { grainGroups: [...kept, group], panels };
    });
    return group.id;
  },

  updateGrainGroup: (id, updates) =>
    set((state) => ({
      grainGroups: state.grainGroups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),

  removeGrainGroup: (id) =>
    set((state) => ({
      grainGroups: state.grainGroups.filter((g) => g.id !== id),
      panels: state.panels.map((p) => (p.grainGroup === id ? { ...p, grainGroup: undefined } : p)),
    })),

  setPanelGroup: (panelId, groupId) =>
    set((state) => {
      const peer = groupId
        ? state.panels.find((p) => p.grainGroup === groupId && p.id !== panelId)
        : undefined;
      const panels = state.panels.map((p) =>
        p.id === panelId
          ? { ...p, grainGroup: groupId, grain: peer ? peer.grain : p.grain }
          : p
      );
      return { panels, grainGroups: pruneGroups(state.grainGroups, panels) };
    }),

  getProjectData: () => {
    const state = get();
    return {
      version: 2 as const,
      name: state.projectName,
      stockSheets: state.stockSheets,
      panels: state.panels,
      kerf: state.kerf,
      cutPreference: state.cutPreference,
      grainGroups: state.grainGroups,
      units: state.units,
      savedAt: new Date().toISOString(),
    };
  },

  loadProjectData: (data) =>
    set({
      projectName: data.name,
      stockSheets: data.stockSheets,
      panels: data.panels,
      kerf: data.kerf,
      units: data.units,
      cutPreference: data.cutPreference,
      grainGroups: data.grainGroups,
    }),

  reset: () =>
    set((s) => ({
      projectName: 'Untitled Project',
      stockSheets: [createDefaultStockSheet()],
      panels: [createDefaultPanel()],
      kerf: s.units === 'metric' ? 3 / 25.4 : 0.125,
      cutPreference: 'auto' as CutPreference,
      grainGroups: [],
    })),
}));
