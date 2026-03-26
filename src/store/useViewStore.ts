import { create } from 'zustand';

export type ViewMode = 'color' | 'mono' | 'outline';

interface ViewState {
  showLabels: boolean;
  viewMode: ViewMode;
  showCutSequence: boolean;

  toggleLabels: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleCutSequence: () => void;
}

export const useViewStore = create<ViewState>((set) => ({
  showLabels: true,
  viewMode: 'color',
  showCutSequence: false,

  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleCutSequence: () => set((s) => ({ showCutSequence: !s.showCutSequence })),
}));
