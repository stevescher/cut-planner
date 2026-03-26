'use client';

import { useViewStore } from '@/store/useViewStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { Button } from '@/components/ui/button';
import { Tag, Palette, Shuffle, ListOrdered } from 'lucide-react';

export function LayoutControls() {
  const { showLabels, monoMode, showCutSequence, toggleLabels, toggleMonoMode, toggleCutSequence } =
    useViewStore();
  const { solutions, revealedCount, shuffleNext } = useLayoutStore();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={showLabels ? 'default' : 'outline'}
        size="sm"
        onClick={toggleLabels}
        title="Toggle labels"
      >
        <Tag className="h-3.5 w-3.5 mr-1" />
        Labels
      </Button>
      <Button
        variant={showCutSequence ? 'default' : 'outline'}
        size="sm"
        onClick={toggleCutSequence}
        title="Toggle cut sequence"
      >
        <ListOrdered className="h-3.5 w-3.5 mr-1" />
        Cuts
      </Button>
      <Button
        variant={monoMode ? 'default' : 'outline'}
        size="sm"
        onClick={toggleMonoMode}
        title="Toggle color mode"
      >
        <Palette className="h-3.5 w-3.5 mr-1" />
        {monoMode ? 'Mono' : 'Color'}
      </Button>
      {solutions.length > revealedCount && (
        <Button variant="outline" size="sm" onClick={shuffleNext}>
          <Shuffle className="h-3.5 w-3.5 mr-1" />
          More Layouts
        </Button>
      )}
    </div>
  );
}
