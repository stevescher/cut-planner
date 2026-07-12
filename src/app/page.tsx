'use client';

import { useEffect } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import { StockSheetForm } from '@/components/forms/StockSheetForm';
import { PanelForm } from '@/components/forms/PanelForm';
import { KerfSetting } from '@/components/forms/KerfSetting';
import { UnitToggle } from '@/components/forms/UnitToggle';
import { ProjectMenu } from '@/components/project/ProjectMenu';
import { LayoutViewer } from '@/components/layout-viewer/LayoutViewer';
import { LayoutControls } from '@/components/layout-viewer/LayoutControls';
import { ExportMenu } from '@/components/export/ExportMenu';
import { useProjectStore } from '@/store/useProjectStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useSaveStatusStore } from '@/store/useSaveStatusStore';
import { useOptimizer } from '@/hooks/useOptimizer';
import { Scissors, Undo2, Redo2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Home() {
  useAutoSave();

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't hijack the browser's native text undo while editing a field.
      if (isEditableTarget(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const entry = useHistoryStore.getState().undo();
        if (entry) {
          useLayoutStore.getState().setSolutions(entry.solutions);
          useLayoutStore.getState().setActive(entry.activeSolutionIndex);
        }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const entry = useHistoryStore.getState().redo();
        if (entry) {
          useLayoutStore.getState().setSolutions(entry.solutions);
          useLayoutStore.getState().setActive(entry.activeSolutionIndex);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { stockSheets, panels } = useProjectStore();
  const { isOptimizing, solutions } = useLayoutStore();
  const saveFailed = useSaveStatusStore((s) => s.saveFailed);
  const optimize = useOptimizer();
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  const handleUndo = () => {
    const entry = useHistoryStore.getState().undo();
    if (entry) {
      useLayoutStore.getState().setSolutions(entry.solutions);
      useLayoutStore.getState().setActive(entry.activeSolutionIndex);
    }
  };

  const handleRedo = () => {
    const entry = useHistoryStore.getState().redo();
    if (entry) {
      useLayoutStore.getState().setSolutions(entry.solutions);
      useLayoutStore.getState().setActive(entry.activeSolutionIndex);
    }
  };

  const canOptimize =
    stockSheets.some((s) => s.length > 0 && s.width > 0) &&
    panels.some((p) => p.length > 0 && p.width > 0);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="h-12 border-b border-slate-200 px-4 flex items-center justify-between bg-white shrink-0 z-10"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
              <Scissors className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">
              Cut <span className="font-medium text-slate-400">Planner</span>
            </span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <ProjectMenu />
          {solutions.length > 0 && (
            <>
              <div className="w-px h-4 bg-slate-200" />
              <ExportMenu />
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {solutions.length > 0 && (
            <>
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
                aria-label="Undo"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500
                           hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (⌘⇧Z)"
                aria-label="Redo"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500
                           hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-4 bg-slate-200" />
              <LayoutControls />
            </>
          )}
        </div>
      </header>

      {/* Autosave failure banner — storage full or unavailable */}
      {saveFailed && (
        <div
          role="alert"
          className="shrink-0 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-2 text-center"
        >
          Autosave failed — your browser storage may be full or disabled. Export your project
          to a file to avoid losing work.
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {/* Stacks vertically on narrow screens (shop tablets/phones) so the
          fixed-width sidebar never crushes the viewer; side-by-side from md up. */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-full md:w-[360px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 max-h-[55vh] md:max-h-none"
          style={{ background: 'var(--sidebar)' }}>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">

              {/* Unit system — must be set before entering any measurements */}
              <UnitToggle />

              {/* Divider */}
              <div className="border-t border-slate-200/70" />

              {/* Stock Sheets */}
              <section>
                <div className="section-header mb-3">Stock Sheets</div>
                <StockSheetForm />
              </section>

              {/* Divider */}
              <div className="border-t border-slate-200/70" />

              {/* Panels */}
              <section>
                <div className="section-header mb-3">Required Panels</div>
                <PanelForm />
              </section>

              {/* Divider */}
              <div className="border-t border-slate-200/70" />

              {/* Settings */}
              <section>
                <div className="section-header mb-3">Blade Settings</div>
                <KerfSetting />
              </section>

            </div>
          </ScrollArea>

          {/* ── Optimize CTA ───────────────────────────────────────────── */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <button
              className="btn-optimize w-full h-11 rounded-xl text-sm flex items-center justify-center gap-2"
              onClick={optimize}
              disabled={!canOptimize || isOptimizing}
            >
              <Scissors className="h-4 w-4" />
              {isOptimizing ? 'Planning…' : 'Plan Cuts'}
            </button>
          </div>
        </aside>

        {/* ── Main viewer ──────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 bg-slate-50/50">
          <LayoutViewer />
        </main>

      </div>
    </div>
  );
}
