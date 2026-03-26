'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { NumberInput } from './NumberInput';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { getColor } from '@/lib/colors';

export function PanelForm() {
  const { panels, addPanel, updatePanel, removePanel } = useProjectStore();

  return (
    <div className="space-y-1.5">
      {/* Column headers */}
      <div className="grid grid-cols-[8px_1fr_72px_72px_46px_28px] gap-2 px-1 pb-0.5">
        <span />
        <span className="field-label">Label</span>
        <span className="field-label">Length</span>
        <span className="field-label">Width</span>
        <span className="field-label">Qty</span>
        <span />
      </div>

      {/* Panel rows */}
      <div className="space-y-1.5">
        {panels.map((panel, idx) => (
          <div
            key={panel.id}
            className="grid grid-cols-[8px_1fr_72px_72px_46px_28px] gap-2 items-center
                       bg-white rounded-lg border border-slate-200 px-2 py-1.5
                       hover:border-indigo-200 transition-colors"
          >
            {/* Color swatch */}
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: getColor(idx) }}
            />
            <Input
              value={panel.label}
              onChange={(e) => updatePanel(panel.id, { label: e.target.value })}
              placeholder={`Panel ${idx + 1}`}
              className="h-8 text-sm border-0 p-0 shadow-none focus-visible:ring-0 bg-transparent"
            />
            <NumberInput
              value={panel.length}
              onChange={(v) => updatePanel(panel.id, { length: v })}
              placeholder='24"'
              fractional
              className="h-8 text-sm"
            />
            <NumberInput
              value={panel.width}
              onChange={(v) => updatePanel(panel.id, { width: v })}
              placeholder='12"'
              fractional
              className="h-8 text-sm"
            />
            <NumberInput
              value={panel.quantity}
              onChange={(v) => updatePanel(panel.id, { quantity: Math.max(1, Math.round(v)) })}
              placeholder="1"
              min={1}
              className="h-8 text-sm"
            />
            <button
              onClick={() => removePanel(panel.id)}
              disabled={panels.length <= 1}
              className="h-6 w-6 rounded flex items-center justify-center text-slate-300
                         hover:text-red-400 hover:bg-red-50 disabled:opacity-30
                         transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => addPanel()}
        className="w-full h-9 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-400
                   hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50
                   transition-all flex items-center justify-center gap-1.5 mt-1"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Panel
      </button>
    </div>
  );
}
