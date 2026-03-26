'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { NumberInput } from './NumberInput';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

export function PanelForm() {
  const { panels, addPanel, updatePanel, removePanel } = useProjectStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Required Panels</h3>
        <Button variant="outline" size="sm" onClick={() => addPanel()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_80px_50px_32px] gap-2 text-xs text-muted-foreground px-1">
        <span>Label</span>
        <span>Length</span>
        <span>Width</span>
        <span>Qty</span>
        <span></span>
      </div>

      {panels.map((panel) => (
        <div
          key={panel.id}
          className="grid grid-cols-[1fr_80px_80px_50px_32px] gap-2 items-center"
        >
          <Input
            value={panel.label}
            onChange={(e) => updatePanel(panel.id, { label: e.target.value })}
            placeholder="Panel name"
            className="h-9"
          />
          <NumberInput
            value={panel.length}
            onChange={(v) => updatePanel(panel.id, { length: v })}
            placeholder='24"'
            fractional
          />
          <NumberInput
            value={panel.width}
            onChange={(v) => updatePanel(panel.id, { width: v })}
            placeholder='12"'
            fractional
          />
          <NumberInput
            value={panel.quantity}
            onChange={(v) =>
              updatePanel(panel.id, { quantity: Math.max(1, Math.round(v)) })
            }
            placeholder="1"
            min={1}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => removePanel(panel.id)}
            disabled={panels.length <= 1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
