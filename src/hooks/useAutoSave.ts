'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { saveToLocalStorage, loadFromLocalStorage } from '@/lib/project-io';

export function useAutoSave() {
  const initialized = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const saved = loadFromLocalStorage();
    if (saved) {
      useProjectStore.getState().loadProjectData(saved);
    }
  }, []);

  // Auto-save on changes
  useEffect(() => {
    const unsub = useProjectStore.subscribe(() => {
      const data = useProjectStore.getState().getProjectData();
      saveToLocalStorage(data);
    });
    return unsub;
  }, []);
}
