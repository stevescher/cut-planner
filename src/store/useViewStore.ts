import { create } from 'zustand';

interface ViewState {
  showLabels: boolean;
  monoMode: boolean;
  showCutSequence: boolean;

  toggleLabels: () => void;
  toggleMonoMode: () => void;
  toggleCutSequence: () => void;
}

export const useViewStore = create<ViewState>((set) => ({
  showLabels: true,
  monoMode: false,
  showCutSequence: false,

  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleMonoMode: () => set((s) => ({ monoMode: !s.monoMode })),
  toggleCutSequence: () => set((s) => ({ showCutSequence: !s.showCutSequence })),
}));
