'use client';

import { useEffect } from 'react';
import { useAutoSave } from '@/hooks/useAutoSave';
import { StockSheetForm } from '@/components/forms/StockSheetForm';
import { PanelForm } from '@/components/forms/PanelForm';
import { KerfSetting } from '@/components/forms/KerfSetting';
import { ProjectMenu } from '@/components/project/ProjectMenu';
import { LayoutViewer } from '@/components/layout-viewer/LayoutViewer';
import { LayoutControls } from '@/components/layout-viewer/LayoutControls';
import { ExportMenu } from '@/components/export/ExportMenu';
import { useProjectStore } from '@/store/useProjectStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useOptimizer } from '@/hooks/useOptimizer';
import { Button } from '@/components/ui/button';
import { Scissors, Undo2, Redo2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  useAutoSave();

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  const optimize = useOptimizer();

  const canOptimize =
    stockSheets.some((s) => s.length > 0 && s.width > 0) &&
    panels.some((p) => p.length > 0 && p.width > 0);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b px-4 py-2 flex items-center justify-between bg-background shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">Cutlist Optimizer</h1>
          <Separator orientation="vertical" className="h-6" />
          <ProjectMenu />
        </div>
        <div className="flex items-center gap-2">
          {solutions.length > 0 && (
            <>
              <LayoutControls />
              <ExportMenu />
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-[380px] border-r bg-muted/30 shrink-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              <StockSheetForm />
              <Separator />
              <PanelForm />
              <Separator />
              <KerfSetting />
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <Button
              className="w-full"
              size="lg"
              onClick={optimize}
              disabled={!canOptimize || isOptimizing}
            >
              <Scissors className="h-4 w-4 mr-2" />
              {isOptimizing ? 'Optimizing...' : 'Optimize Cuts'}
            </Button>
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 min-w-0 bg-muted/10">
          <LayoutViewer />
        </main>
      </div>
    </div>
  );
}
