'use client';

import { useCallback } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { solveAll } from '@/lib/optimizer/solver';

export function useOptimizer() {
  const optimize = useCallback(() => {
    const { stockSheets, panels, kerf } = useProjectStore.getState();
    const { setOptimizing, setSolutions } = useLayoutStore.getState();

    setOptimizing(true);

    // Run in a setTimeout to let the UI update with the loading state
    setTimeout(() => {
      try {
        const solutions = solveAll({ stockSheets, panels, kerf });
        setSolutions(solutions);
      } catch (e) {
        console.error('Optimization failed:', e);
        setSolutions([]);
      } finally {
        setOptimizing(false);
      }
    }, 50);
  }, []);

  return optimize;
}
