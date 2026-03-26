import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { StockSheet, Panel, ProjectData } from '@/lib/optimizer/types';

interface ProjectState {
  projectName: string;
  stockSheets: StockSheet[];
  panels: Panel[];
  kerf: number;

  setProjectName: (name: string) => void;
  setKerf: (kerf: number) => void;

  addStockSheet: (sheet?: Partial<StockSheet>) => void;
  updateStockSheet: (id: string, updates: Partial<StockSheet>) => void;
  removeStockSheet: (id: string) => void;

  addPanel: (panel?: Partial<Panel>) => void;
  updatePanel: (id: string, updates: Partial<Panel>) => void;
  removePanel: (id: string) => void;

  getProjectData: () => ProjectData;
  loadProjectData: (data: ProjectData) => void;
  reset: () => void;
}

function createDefaultStockSheet(overrides?: Partial<StockSheet>): StockSheet {
  return {
    id: nanoid(),
    label: '',
    material: '',
    length: 96,
    width: 48,
    quantity: 1,
    trimTop: 0,
    trimRight: 0,
    trimBottom: 0,
    trimLeft: 0,
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
    ...overrides,
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectName: 'Untitled Project',
  stockSheets: [createDefaultStockSheet()],
  panels: [createDefaultPanel()],
  kerf: 0.125, // 1/8 inch

  setProjectName: (name) => set({ projectName: name }),
  setKerf: (kerf) => set({ kerf }),

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
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  removePanel: (id) =>
    set((state) => ({
      panels: state.panels.filter((p) => p.id !== id),
    })),

  getProjectData: () => {
    const state = get();
    return {
      version: 1 as const,
      name: state.projectName,
      stockSheets: state.stockSheets,
      panels: state.panels,
      kerf: state.kerf,
      savedAt: new Date().toISOString(),
    };
  },

  loadProjectData: (data) =>
    set({
      projectName: data.name,
      stockSheets: data.stockSheets,
      panels: data.panels,
      kerf: data.kerf,
    }),

  reset: () =>
    set({
      projectName: 'Untitled Project',
      stockSheets: [createDefaultStockSheet()],
      panels: [createDefaultPanel()],
      kerf: 0.125,
    }),
}));
