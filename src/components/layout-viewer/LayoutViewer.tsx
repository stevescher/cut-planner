'use client';

import { useState } from 'react';
import { useLayoutStore } from '@/store/useLayoutStore';
import { SheetCanvas } from './SheetCanvas';
import { CutChecklist } from '@/components/cut-list/CutChecklist';
import { useProjectStore } from '@/store/useProjectStore';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { LayoutGrid, ClipboardList } from 'lucide-react';

export function LayoutViewer() {
  const { solutions, activeSolutionIndex, revealedCount, setActive } =
    useLayoutStore();
  const { stockSheets } = useProjectStore();
  const [view, setView] = useState<'diagram' | 'checklist'>('diagram');

  if (solutions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <LayoutGrid className="h-16 w-16 opacity-20" />
        <p className="text-lg">Add stock sheets and panels, then click Optimize</p>
        <p className="text-sm">Your cutting layouts will appear here</p>
      </div>
    );
  }

  const visibleSolutions = solutions.slice(0, revealedCount);
  const activeSolution = solutions[activeSolutionIndex];

  return (
    <div className="flex flex-col h-full">
      {/* Solution tabs + view toggle */}
      <div className="p-3 border-b shrink-0 flex items-center justify-between gap-4">
        {visibleSolutions.length > 1 ? (
          <Tabs
            value={String(activeSolutionIndex)}
            onValueChange={(v) => setActive(Number(v))}
          >
            <TabsList>
              {visibleSolutions.map((sol, i) => (
                <TabsTrigger key={sol.id} value={String(i)}>
                  Layout {i + 1}
                  <span className="ml-1.5 text-xs opacity-70">
                    {sol.totalSheets} sheet{sol.totalSheets !== 1 ? 's' : ''} /{' '}
                    {sol.totalWaste.toFixed(1)}% waste
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <div />
        )}

        {/* View toggle */}
        <div className="flex gap-1 shrink-0">
          <Button
            variant={view === 'diagram' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('diagram')}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1" />
            Diagram
          </Button>
          <Button
            variant={view === 'checklist' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('checklist')}
          >
            <ClipboardList className="h-3.5 w-3.5 mr-1" />
            Checklist
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {view === 'checklist' && activeSolution ? (
          <CutChecklist solution={activeSolution} stockSheets={stockSheets} />
        ) : (
          <div className="p-6 space-y-8" data-export-target>
            {activeSolution && (
              <>
                {/* Summary bar */}
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Sheets used:{' '}
                    <span className="font-medium text-foreground">
                      {activeSolution.totalSheets}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Total waste:{' '}
                    <span className="font-medium text-foreground">
                      {activeSolution.totalWaste.toFixed(1)}%
                    </span>
                  </span>
                  {activeSolution.unplacedPanels.length > 0 && (
                    <span className="text-destructive font-medium">
                      {activeSolution.unplacedPanels.length} panel(s) could not fit
                    </span>
                  )}
                </div>

                {/* Individual sheet canvases */}
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
