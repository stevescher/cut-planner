'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { NumberInput } from './NumberInput';
import { StockPresetSelect } from './StockPresetSelect';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export function StockSheetForm() {
  const { stockSheets, addStockSheet, updateStockSheet, removeStockSheet, units } =
    useProjectStore();
  const [expandedTrim, setExpandedTrim] = useState<string | null>(null);

  return (
    <div className="space-y-2.5">
      {stockSheets.map((sheet, idx) => (
        <div key={sheet.id} className="form-card space-y-3">

          {/* Row 1: preset + label + delete */}
          <div className="flex gap-2 items-center">
            <StockPresetSelect
              onSelect={(length, width) => updateStockSheet(sheet.id, { length, width })}
              units={units}
            />
            <Input
              value={sheet.label}
              onChange={(e) => updateStockSheet(sheet.id, { label: e.target.value })}
              placeholder={`Sheet ${idx + 1}`}
              className="flex-1 h-9 text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0"
              onClick={() => removeStockSheet(sheet.id)}
              disabled={stockSheets.length <= 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Row 2: dimensions */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="field-label">Length</label>
              <NumberInput
                value={sheet.length}
                onChange={(v) => updateStockSheet(sheet.id, { length: v })}
                placeholder={units === 'metric' ? '2440' : '96'}
                units={units}
              />
            </div>
            <div>
              <label className="field-label">Width</label>
              <NumberInput
                value={sheet.width}
                onChange={(v) => updateStockSheet(sheet.id, { width: v })}
                placeholder={units === 'metric' ? '1220' : '48'}
                units={units}
              />
            </div>
            <div>
              <label className="field-label">Qty</label>
              <NumberInput
                value={sheet.quantity}
                onChange={(v) => updateStockSheet(sheet.id, { quantity: Math.max(1, Math.round(v)) })}
                placeholder="1"
                min={1}
              />
            </div>
          </div>

          {/* Edge trim toggle */}
          <button
            onClick={() => setExpandedTrim(expandedTrim === sheet.id ? null : sheet.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-500 transition-colors"
          >
            {expandedTrim === sheet.id ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Edge Trim
          </button>

          {expandedTrim === sheet.id && (
            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100">
              {(['trimTop', 'trimRight', 'trimBottom', 'trimLeft'] as const).map((side) => (
                <div key={side}>
                  <label className="field-label">{side.replace('trim', '')}</label>
                  <NumberInput
                    value={sheet[side]}
                    onChange={(v) => updateStockSheet(sheet.id, { [side]: v })}
                    placeholder="0"
                    units={units}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={() => addStockSheet()}
        className="w-full h-9 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-400
                   hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50
                   transition-all flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Stock Sheet
      </button>
    </div>
  );
}
