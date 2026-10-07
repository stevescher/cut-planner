'use client';

import { useCallback, useEffect, useRef } from 'react';
import { wrap, Remote } from 'comlink';
import { useProjectStore } from '@/store/useProjectStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useDragStore } from '@/store/useDragStore';
import { solveAll } from '@/lib/optimizer/solver';
import { needsGrainChoice } from '@/lib/materials';
import {
  ConstraintCosts,
  constraintDelta,
  cutOrderIsActive,
  grainIsActive,
  groupsAreActive,
  relaxGrain,
} from '@/lib/constraint-cost';

type WorkerApi = { solveAll: typeof solveAll };
type SolveConfig = Parameters<typeof solveAll>[0];

export function useOptimizer() {
  const remoteRef = useRef<Remote<WorkerApi> | null>(null);
  const workerRef = useRef<Worker | null>(null);
  // Incremented per plan, so a slow comparison solve from an earlier plan never
  // writes its costs over a newer plan.
  const runRef = useRef(0);

  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL('../lib/optimizer/optimizer.worker.ts', import.meta.url)
      );
      worker.onerror = () => {
        // Worker failed to load (e.g. bundler doesn't support this pattern in dev).
        // The optimize() fallback path will use the main-thread solver instead.
        remoteRef.current = null;
        workerRef.current = null;
      };
      workerRef.current = worker;
      remoteRef.current = wrap<WorkerApi>(worker);
    } catch {
      // Worker construction not supported in this environment — fallback is used.
    }

    return () => {
      worker?.terminate();
      workerRef.current = null;
      remoteRef.current = null;
    };
  }, []);

  const solve = useCallback(async (config: SolveConfig) => {
    if (remoteRef.current) return remoteRef.current.solveAll(config);
    // Worker not yet initialized: fall back to a main-thread synchronous call
    return solveAll(config);
  }, []);

  const optimize = useCallback(async () => {
    const { stockSheets, panels, kerf, cutPreference, grainGroups } = useProjectStore.getState();
    // Same gate as the Plan Cuts button, for other callers (add-sheets re-plan):
    // a square grained sheet needs a grain direction before it can be planned.
    if (stockSheets.some(needsGrainChoice)) return;
    const { setOptimizing, setSolutions, setConstraintCosts } = useLayoutStore.getState();
    const run = ++runRef.current;

    // A fresh plan produces brand-new placement arrays, so any pins (which are
    // keyed by placement index) from a previous plan are meaningless and could
    // anchor the wrong pieces on a later re-plan. Clear them. (OPUS-402)
    useDragStore.getState().clearPins();

    setOptimizing(true);
    let best;
    try {
      const solutions = await solve({ stockSheets, panels, kerf, cutPreference, grainGroups });
      setSolutions(solutions);
      best = solutions[0];
    } catch (e) {
      console.error('Optimization failed:', e);
      setSolutions([]);
    } finally {
      setOptimizing(false);
    }

    // Constraint cost readout: re-solve with each active constraint relaxed
    // and compare best plans. This runs after the main result is on screen,
    // since it doubles or triples the solver work.
    if (!best) return;
    const grainOn = grainIsActive(stockSheets, panels);
    const groupsOn = groupsAreActive(panels, grainGroups);
    const cutOrderOn = cutOrderIsActive(cutPreference);
    if (!grainOn && !groupsOn && !cutOrderOn) return;
    try {
      const costs: ConstraintCosts = {};
      // Each comparison relaxes one setting and keeps the others, so the
      // readout says what that setting alone costs.
      if (grainOn) {
        const relaxed = await solve({ stockSheets, panels: relaxGrain(panels), kerf, cutPreference, grainGroups });
        if (relaxed[0]) costs.grain = constraintDelta(best, relaxed[0], stockSheets);
      }
      if (groupsOn) {
        const relaxed = await solve({ stockSheets, panels, kerf, cutPreference, grainGroups: [] });
        if (relaxed[0]) costs.groups = constraintDelta(best, relaxed[0], stockSheets);
      }
      if (cutOrderOn) {
        const relaxed = await solve({ stockSheets, panels, kerf, cutPreference: 'auto', grainGroups });
        if (relaxed[0]) costs.cutOrder = constraintDelta(best, relaxed[0], stockSheets);
      }
      // Skip if a newer plan started, or an anchored re-plan replaced the
      // layout this comparison was measured against.
      const current = useLayoutStore.getState().solutions[0];
      if (run === runRef.current && current?.id === best.id) setConstraintCosts(costs);
    } catch (e) {
      console.error('Constraint cost comparison failed:', e);
    }
  }, [solve]);

  return optimize;
}
