import { create } from 'zustand';
import { Solution } from '@/lib/optimizer/types';

export interface HistoryEntry {
  solutions: Solution[];
  activeSolutionIndex: number;
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];

  pushState: (entry: HistoryEntry) => void;
  /** Pass the current (live) layout so it can be moved onto the redo stack. */
  undo: (current: HistoryEntry) => HistoryEntry | null;
  /** Pass the current (live) layout so it can be moved onto the undo stack. */
  redo: (current: HistoryEntry) => HistoryEntry | null;
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
      // Keep at most MAX_HISTORY entries total once this one is appended.
      past: [...state.past.slice(-(MAX_HISTORY - 1)), entry],
      future: [],
    })),

  undo: (current) => {
    const { past } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    set((state) => ({
      past: state.past.slice(0, -1),
      // Move the state we're leaving (the live one) onto the redo stack, so
      // a subsequent redo can restore it. Pushing `previous` here would lose it.
      future: [current, ...state.future],
    }));
    return previous;
  },

  redo: (current) => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set((state) => ({
      // Symmetric with undo: the live state we're leaving goes back onto the
      // undo stack so it can be undone again.
      past: [...state.past, current],
      future: state.future.slice(1),
    }));
    return next;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clear: () => set({ past: [], future: [] }),
}));
