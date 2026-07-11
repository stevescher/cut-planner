'use client';

import { useEffect } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useSaveStatusStore } from '@/store/useSaveStatusStore';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/project-io';

/** Trailing debounce (ms) so a burst of edits (typing a dimension, a bulk CSV
 *  import) collapses into one localStorage write instead of one per keystroke. */
const SAVE_DEBOUNCE_MS = 400;

export function useAutoSave() {
  // Single effect guarantees load executes before subscribe is registered,
  // eliminating the race where an immediate Zustand state change could fire
  // the subscriber before the saved data has been loaded.
  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved) {
      useProjectStore.getState().loadProjectData(saved);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      const ok = saveToLocalStorage(useProjectStore.getState().getProjectData());
      useSaveStatusStore.getState().setSaveFailed(!ok);
    };

    const unsub = useProjectStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    });

    // Page termination (tab close, reload, navigation) does not reliably run
    // React effect cleanup, so a debounced edit could be lost inside the 400 ms
    // window. Flush synchronously on pagehide/visibility-hidden — the events
    // browsers guarantee before unload — so the latest edit is always persisted.
    const flushIfPending = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        // Report failure too: on visibilitychange the page may return to the
        // foreground, and the user must see the warning if this write failed.
        const ok = saveToLocalStorage(useProjectStore.getState().getProjectData());
        useSaveStatusStore.getState().setSaveFailed(!ok);
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushIfPending();
    };
    window.addEventListener('pagehide', flushIfPending);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unsub();
      window.removeEventListener('pagehide', flushIfPending);
      document.removeEventListener('visibilitychange', onVisibility);
      // Persist any pending change on unmount too (SPA navigation within the app).
      if (timer) {
        clearTimeout(timer);
        const ok = saveToLocalStorage(useProjectStore.getState().getProjectData());
        useSaveStatusStore.getState().setSaveFailed(!ok);
      }
    };
  }, []);
}
