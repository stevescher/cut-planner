'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { NumberInput } from './NumberInput';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Lock, Unlock, Upload } from 'lucide-react';
import { getColor } from '@/lib/colors';
import { PanelImport } from './PanelImport';

export function PanelForm() {
  const { panels, addPanel, updatePanel, removePanel, units } = useProjectStore();
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="space-y-1.5">
      {/* Column headers */}
      <div className="grid grid-cols-[8px_1fr_72px_72px_46px_24px_24px] gap-2 px-1 pb-0.5">
        <span />
        <span className="field-label">Label</span>
        <span className="field-label">Length</span>
        <span className="field-label">Width</span>
        <span className="field-label">Qty</span>
        <span />
        <span />
      </div>

      {/* Panel rows */}
      <div className="space-y-1.5">
        {panels.map((panel, idx) => (
          <div
            key={panel.id}
            className="grid grid-cols-[8px_1fr_72px_72px_46px_24px_24px] gap-2 items-center
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
              placeholder={units === 'metric' ? '600' : '24'}
              units={units}
              className="h-8 text-sm"
            />
            <NumberInput
              value={panel.width}
              onChange={(v) => updatePanel(panel.id, { width: v })}
              placeholder={units === 'metric' ? '300' : '12'}
              units={units}
              className="h-8 text-sm"
            />
            <NumberInput
              value={panel.quantity}
              onChange={(v) => updatePanel(panel.id, { quantity: Math.max(1, Math.round(v)) })}
              placeholder="1"
              min={1}
              className="h-8 text-sm"
            />
            {/* Lock rotation toggle */}
            <button
              onClick={() => updatePanel(panel.id, { lockRotation: !panel.lockRotation })}
              title={panel.lockRotation ? 'Rotation locked — click to allow' : 'Click to lock grain direction'}
              className={`h-6 w-6 rounded flex items-center justify-center transition-colors
                ${panel.lockRotation
                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                  : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}
            >
              {panel.lockRotation
                ? <Lock className="h-3 w-3" />
                : <Unlock className="h-3 w-3" />}
            </button>
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

      {/* Import panel (inline) */}
      {showImport && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 mt-1">
          <PanelImport onClose={() => setShowImport(false)} />
        </div>
      )}

      {/* Add Panel + Import CSV buttons */}
      {!showImport && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => addPanel()}
            className="flex-1 h-9 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-400
                       hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50
                       transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Panel
          </button>
          <button
            onClick={() => setShowImport(true)}
            title="Import panels from CSV"
            className="h-9 px-3 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-400
                       hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50
                       transition-all flex items-center justify-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      )}
    </div>
  );
}
