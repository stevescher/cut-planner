import { create } from 'zustand';
import { Placement } from '@/lib/optimizer/types';

interface DragState {
  /** Currently dragging piece info */
  dragging: {
    sheetIndex: number;
    placementIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null;

  /** Pinned placements per sheet (key: "stockSheetId-sheetIndex") */
  pinnedPieces: Set<string>; // "sheetKey:placementIndex"

  startDrag: (sheetIndex: number, placementIndex: number, x: number, y: number) => void;
  updateDrag: (x: number, y: number) => void;
  endDrag: () => void;
  togglePin: (sheetKey: string, placementIndex: number) => void;
  isPinned: (sheetKey: string, placementIndex: number) => boolean;
  clearPins: () => void;
}

export const useDragStore = create<DragState>((set, get) => ({
  dragging: null,
  pinnedPieces: new Set<string>(),

  startDrag: (sheetIndex, placementIndex, x, y) =>
    set({
      dragging: {
        sheetIndex,
        placementIndex,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      },
    }),

  updateDrag: (x, y) =>
    set((state) => {
      if (!state.dragging) return state;
      return {
        dragging: { ...state.dragging, currentX: x, currentY: y },
      };
    }),

  endDrag: () => set({ dragging: null }),

  togglePin: (sheetKey, placementIndex) =>
    set((state) => {
      const key = `${sheetKey}:${placementIndex}`;
      const newPins = new Set(state.pinnedPieces);
      if (newPins.has(key)) {
        newPins.delete(key);
      } else {
        newPins.add(key);
      }
      return { pinnedPieces: newPins };
    }),

  isPinned: (sheetKey, placementIndex) => {
    return get().pinnedPieces.has(`${sheetKey}:${placementIndex}`);
  },

  clearPins: () => set({ pinnedPieces: new Set<string>() }),
}));
