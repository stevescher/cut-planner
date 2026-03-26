import { create } from 'zustand';
import { Solution } from '@/lib/optimizer/types';

interface HistoryEntry {
  solutions: Solution[];
  activeSolutionIndex: number;
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];

  pushState: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

const MAX_HISTORY = 50;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  pushState: (entry) =>
    set((state) => ({
      past: [...state.past.slice(-MAX_HISTORY), entry],
      future: [],
    })),

  undo: () => {
    const { past } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    set((state) => ({
      past: state.past.slice(0, -1),
      future: [previous, ...state.future],
    }));
    return previous;
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set((state) => ({
      past: [...state.past, next],
      future: state.future.slice(1),
    }));
    return next;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clear: () => set({ past: [], future: [] }),
}));
