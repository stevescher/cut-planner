'use client';

import { useState } from 'react';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useDragStore } from '@/store/useDragStore';
import { SheetCanvas } from './SheetCanvas';
import { CutChecklist } from '@/components/cut-list/CutChecklist';
import { useProjectStore } from '@/store/useProjectStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { reOptimizeAroundPinned } from '@/lib/optimizer/reoptimize';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { LayoutGrid, ClipboardList, Anchor, RefreshCw } from 'lucide-react';

export function LayoutViewer() {
  const { solutions, activeSolutionIndex, revealedCount, setActive, setSolutions } =
    useLayoutStore();
  const { stockSheets, kerf } = useProjectStore();
  const { pinnedPieces } = useDragStore();
  const pinnedCount = pinnedPieces.size;
  const [view, setView] = useState<'diagram' | 'checklist'>('diagram');
  const [reOptimizing, setReOptimizing] = useState(false);

  if (solutions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
          <LayoutGrid className="h-8 w-8 text-slate-300" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-slate-500">No layouts yet</p>
          <p className="text-sm text-slate-400 mt-1">Add stock sheets and panels, then click Optimize Cuts</p>
        </div>
      </div>
    );
  }

  const visibleSolutions = solutions.slice(0, revealedCount);
  const activeSolution = solutions[activeSolutionIndex];

  const handleReOptimize = () => {
    if (!activeSolution) return;
    setReOptimizing(true);

    // Save for undo
    const layoutStore = useLayoutStore.getState();
    useHistoryStore.getState().pushState({
      solutions: layoutStore.solutions,
      activeSolutionIndex: layoutStore.activeSolutionIndex,
    });

    setTimeout(() => {
      const reOptimized = reOptimizeAroundPinned(
        activeSolution,
        stockSheets,
        pinnedPieces,
        kerf
      );
      // Inject re-optimized result as a new top solution
      const updated = [reOptimized, ...solutions.filter((s) => s.id !== activeSolution.id)];
      setSolutions(updated);
      setActive(0);
      setReOptimizing(false);
    }, 50);
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar: layout selector + view toggle ───────────────────── */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between gap-4">
        {/* Layout pills */}
        {visibleSolutions.length > 1 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Layout
            </span>
            {visibleSolutions.map((sol, i) => (
              <button
                key={sol.id}
                onClick={() => setActive(i)}
                title={`${sol.totalSheets} sheet${sol.totalSheets !== 1 ? 's' : ''} · ${sol.totalWaste.toFixed(1)}% waste`}
                className={[
                  'h-7 min-w-[28px] px-2.5 rounded-full text-[11px] font-bold transition-all',
                  i === activeSolutionIndex
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                ].join(' ')}
              >
                {i + 1}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        {/* View toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setView('diagram')}
            className={[
              'h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
              view === 'diagram'
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
            ].join(' ')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Diagram
          </button>
          <button
            onClick={() => setView('checklist')}
            className={[
              'h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all',
              view === 'checklist'
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
            ].join(' ')}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Shop List
          </button>
        </div>
      </div>

      {/* ── Anchor banner ────────────────────────────────────────────── */}
      {pinnedCount > 0 && view === 'diagram' && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50
                        flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Anchor className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <strong>{pinnedCount} piece{pinnedCount !== 1 ? 's' : ''} anchored</strong>
              {' '}— click Re-optimize to pack everything else around them
            </span>
          </div>
          <button
            onClick={handleReOptimize}
            disabled={reOptimizing}
            className="shrink-0 h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-600
                       text-white text-xs font-bold flex items-center gap-1.5
                       disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reOptimizing ? 'animate-spin' : ''}`} />
            {reOptimizing ? 'Working…' : 'Re-optimize'}
          </button>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        {view === 'checklist' && activeSolution ? (
          <CutChecklist solution={activeSolution} stockSheets={stockSheets} />
        ) : (
          <div className="p-6 space-y-8" data-export-target>
            {activeSolution && (
              <>
                {/* Summary stats */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sheets</span>
                    <span className="text-lg font-bold text-slate-800">{activeSolution.totalSheets}</span>
                  </div>
                  <div className="w-px h-5 bg-slate-200" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Waste</span>
                    <span className={`text-lg font-bold ${
                      activeSolution.totalWaste < 15 ? 'text-emerald-600' :
                      activeSolution.totalWaste < 30 ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {activeSolution.totalWaste.toFixed(1)}%
                    </span>
                  </div>
                  {activeSolution.unplacedPanels.length > 0 && (
                    <>
                      <div className="w-px h-5 bg-slate-200" />
                      <span className="text-sm font-semibold text-red-500">
                        ⚠ {activeSolution.unplacedPanels.length} panel{activeSolution.unplacedPanels.length !== 1 ? 's' : ''} couldn&apos;t fit
                      </span>
                    </>
                  )}
                  {activeSolution.strategyName === 'Re-optimized (anchored)' && (
                    <span className="ml-auto text-[11px] font-semibold text-amber-600 bg-amber-50
                                     border border-amber-200 rounded-full px-2.5 py-0.5">
                      ⚓ Anchored layout
                    </span>
                  )}
                </div>

                {/* Sheet canvases */}
                {activeSolution.sheets.map((sheetLayout, i) => {
                  const stockSheet = stockSheets.find(
                    (s) => s.id === sheetLayout.stockSheetId
                  );
                  return (
                    <SheetCanvas
                      key={`${sheetLayout.stockSheetId}-${sheetLayout.sheetIndex}`}
                      sheetLayout={sheetLayout}
                      stockSheet={stockSheet!}
                      sheetNumber={i + 1}
                    />
                  );
                })}
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
