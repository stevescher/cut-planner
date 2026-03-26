import { create } from 'zustand';
import { Solution } from '@/lib/optimizer/types';

interface LayoutState {
  solutions: Solution[];
  activeSolutionIndex: number;
  isOptimizing: boolean;
  /** How many solutions have been revealed (for shuffle) */
  revealedCount: number;

  setSolutions: (solutions: Solution[]) => void;
  setActive: (index: number) => void;
  setOptimizing: (optimizing: boolean) => void;
  shuffleNext: () => void;
  reset: () => void;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  solutions: [],
  activeSolutionIndex: 0,
  isOptimizing: false,
  revealedCount: 3,

  setSolutions: (solutions) =>
    set({
      solutions,
      activeSolutionIndex: 0,
      revealedCount: Math.min(3, solutions.length),
    }),

  setActive: (index) => set({ activeSolutionIndex: index }),
  setOptimizing: (optimizing) => set({ isOptimizing: optimizing }),

  shuffleNext: () => {
    const { solutions, revealedCount } = get();
    if (revealedCount < solutions.length) {
      set({ revealedCount: Math.min(revealedCount + 3, solutions.length) });
    }
  },

  reset: () =>
    set({
      solutions: [],
      activeSolutionIndex: 0,
      isOptimizing: false,
      revealedCount: 3,
    }),
}));
