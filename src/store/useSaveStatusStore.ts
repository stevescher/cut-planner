import { create } from 'zustand';

interface SaveStatusState {
  /** True when the last autosave write failed (quota, private mode, disabled). */
  saveFailed: boolean;
  setSaveFailed: (failed: boolean) => void;
}

/** Tracks whether autosave is currently working, so the UI can warn the user to
 *  export manually rather than silently losing their project. */
export const useSaveStatusStore = create<SaveStatusState>((set) => ({
  saveFailed: false,
  setSaveFailed: (failed) => set({ saveFailed: failed }),
}));
