'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { NumberInput } from './NumberInput';
import { StockPresetSelect } from './StockPresetSelect';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export function StockSheetForm() {
  const { stockSheets, addStockSheet, updateStockSheet, removeStockSheet } =
    useProjectStore();
  const [expandedTrim, setExpandedTrim] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Stock Sheets</h3>
        <Button variant="outline" size="sm" onClick={() => addStockSheet()}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {stockSheets.map((sheet) => (
        <div
          key={sheet.id}
          className="border rounded-lg p-3 space-y-2 bg-card"
        >
          <div className="flex gap-2 items-center">
            <StockPresetSelect
              onSelect={(length, width) => {
                updateStockSheet(sheet.id, { length, width });
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => removeStockSheet(sheet.id)}
              disabled={stockSheets.length <= 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Length</label>
              <NumberInput
                value={sheet.length}
                onChange={(v) => updateStockSheet(sheet.id, { length: v })}
                placeholder="96"
                fractional
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Width</label>
              <NumberInput
                value={sheet.width}
                onChange={(v) => updateStockSheet(sheet.id, { width: v })}
                placeholder="48"
                fractional
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Qty</label>
              <NumberInput
                value={sheet.quantity}
                onChange={(v) =>
                  updateStockSheet(sheet.id, { quantity: Math.max(1, Math.round(v)) })
                }
                placeholder="1"
                min={1}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Material</label>
              <Input
                value={sheet.material}
                onChange={(e) =>
                  updateStockSheet(sheet.id, { material: e.target.value })
                }
                placeholder="Plywood"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Label</label>
            <Input
              value={sheet.label}
              onChange={(e) =>
                updateStockSheet(sheet.id, { label: e.target.value })
              }
              placeholder="e.g. 4x8 Birch"
              className="h-9"
            />
          </div>

          {/* Edge trim toggle */}
          <button
            onClick={() =>
              setExpandedTrim(expandedTrim === sheet.id ? null : sheet.id)
            }
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expandedTrim === sheet.id ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Edge Trim
          </button>

          {expandedTrim === sheet.id && (
            <div className="grid grid-cols-4 gap-2">
              {(['trimTop', 'trimRight', 'trimBottom', 'trimLeft'] as const).map(
                (side) => (
                  <div key={side}>
                    <label className="text-xs text-muted-foreground capitalize">
                      {side.replace('trim', '')}
                    </label>
                    <NumberInput
                      value={sheet[side]}
                      onChange={(v) =>
                        updateStockSheet(sheet.id, { [side]: v })
                      }
                      placeholder="0"
                      fractional
                    />
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
