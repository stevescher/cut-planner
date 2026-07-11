import { create } from 'zustand';

interface ChecklistState {
  /** Keys ("sheetId-sheetIndex:placementIndex") of pieces checked off. */
  checked: Record<string, boolean>;
  toggle: (key: string) => void;
  reset: () => void;
}

/** Tracks which cut-list pieces the user has checked off. Kept in its own store
 *  so the state survives switching between the Diagram and Shop List views. */
export const useChecklistStore = create<ChecklistState>((set) => ({
  checked: {},
  toggle: (key) =>
    set((s) => ({ checked: { ...s.checked, [key]: !s.checked[key] } })),
  reset: () => set({ checked: {} }),
}));
