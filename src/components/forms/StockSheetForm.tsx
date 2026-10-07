'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { NumberInput } from './NumberInput';
import { StockPresetSelect } from './StockPresetSelect';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useId, useState } from 'react';
import { parsePrice } from '@/lib/cost';
import { MATERIAL_PRESETS, dimensionUpdates, materialUpdates, needsGrainChoice } from '@/lib/materials';

/** Matches the import validator's ceiling (src/lib/project-io.ts). */
const MAX_DIMENSION = 10_000;

/**
 * Optional currency input. Empty maps to `undefined` (unpriced), not 0, so an
 * unset price is distinguishable from a genuinely free ($0) sheet. Rejects
 * negatives, non-numbers, and out-of-range values by keeping the raw text and
 * flagging the field rather than silently coercing.
 */
function PriceInput({
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  'aria-label'?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState('');
  const [invalid, setInvalid] = useState(false);

  const display = value === undefined ? '' : String(value);
  const shown = focused || invalid ? rawText : display;

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
      >
        $
      </span>
      <Input
        type="text"
        inputMode="decimal"
        value={shown}
        placeholder="—"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onFocus={() => {
          setFocused(true);
          if (!invalid) setRawText(display);
        }}
        onChange={(e) => {
          setRawText(e.target.value);
          if (invalid) setInvalid(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={() => {
          setFocused(false);
          // parsePrice rejects a partial/garbage entry ("12abc", "1,0.0.0") by
          // returning null rather than storing a wrong numeric prefix, since this
          // value drives the displayed and exported material totals.
          const result = parsePrice(rawText);
          if (result === null) {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          onChange(result);
        }}
        className={`h-9 text-sm pl-6 ${
          invalid ? 'border-red-400 focus-visible:ring-red-400/40' : ''
        }`}
      />
    </div>
  );
}

export function StockSheetForm() {
  const { stockSheets, addStockSheet, updateStockSheet, removeStockSheet, units } =
    useProjectStore();
  const [expandedTrim, setExpandedTrim] = useState<string | null>(null);
  // Stable across server and client render (sheet ids are random per load,
  // which made the label/control ids mismatch on hydration).
  const fieldId = useId();

  return (
    <div className="space-y-2.5">
      {stockSheets.map((sheet, idx) => (
        <div key={sheet.id} className="form-card space-y-3">

          {/* Row 1: preset + label + delete */}
          <div className="flex gap-2 items-center">
            <StockPresetSelect
              onSelect={(length, width) => updateStockSheet(sheet.id, dimensionUpdates(sheet, { length, width }))}
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
              className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
              onClick={() => removeStockSheet(sheet.id)}
              disabled={stockSheets.length <= 1}
              aria-label={`Remove ${sheet.label || `Sheet ${idx + 1}`}`}
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
                onChange={(v) => updateStockSheet(sheet.id, dimensionUpdates(sheet, { length: v }))}
                placeholder={units === 'metric' ? '2440' : '96'}
                units={units}
                max={MAX_DIMENSION}
                aria-label={`${sheet.label || `Sheet ${idx + 1}`} length`}
              />
            </div>
            <div>
              <label className="field-label">Width</label>
              <NumberInput
                value={sheet.width}
                onChange={(v) => updateStockSheet(sheet.id, dimensionUpdates(sheet, { width: v }))}
                placeholder={units === 'metric' ? '1220' : '48'}
                units={units}
                max={MAX_DIMENSION}
                aria-label={`${sheet.label || `Sheet ${idx + 1}`} width`}
              />
            </div>
            <div>
              <label className="field-label">Qty</label>
              <NumberInput
                value={sheet.quantity}
                onChange={(v) => updateStockSheet(sheet.id, { quantity: Math.min(100, Math.max(1, Math.round(v))) })}
                placeholder="1"
                min={1}
                max={100}
                aria-label={`${sheet.label || `Sheet ${idx + 1}`} quantity`}
              />
            </div>
          </div>

          {/* Material preset: pre-fills grain (and the label if empty) */}
          <div>
            <label className="field-label" htmlFor={`${fieldId}-material-${idx}`}>Material</label>
            <select
              id={`${fieldId}-material-${idx}`}
              value={sheet.material ?? ''}
              onChange={(e) => updateStockSheet(sheet.id, materialUpdates(sheet, e.target.value || undefined))}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground
                         focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">Other / not set</option>
              <optgroup label="Has grain">
                {MATERIAL_PRESETS.filter((m) => m.grained).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
              <optgroup label="No grain">
                {MATERIAL_PRESETS.filter((m) => !m.grained).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Row 3: price per sheet + grain direction (both optional) */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="field-label">Price / sheet</label>
              <PriceInput
                value={sheet.pricePerSheet}
                onChange={(v) => updateStockSheet(sheet.id, { pricePerSheet: v })}
                aria-label={`${sheet.label || `Sheet ${idx + 1}`} price per sheet`}
              />
            </div>
            <div className="col-span-2">
              <label className="field-label">Grain direction</label>
              <div className="flex rounded-lg bg-muted p-0.5 gap-px h-9">
                {(['length', 'width', 'none'] as const).map((dir) => {
                  const active = sheet.grainDirection === dir;
                  return (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => updateStockSheet(sheet.id, { grainDirection: dir })}
                      aria-pressed={active}
                      aria-label={
                        dir === 'none'
                          ? `${sheet.label || `Sheet ${idx + 1}`} has no grain`
                          : `${sheet.label || `Sheet ${idx + 1}`} grain along ${dir}`
                      }
                      title={
                        dir === 'none'
                          ? 'No grain: MDF, particleboard, solid-color melamine'
                          : `Face grain runs along the sheet ${dir}`
                      }
                      className={[
                        'flex-1 rounded-md text-xs font-semibold capitalize transition-all',
                        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                    >
                      {dir}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {needsGrainChoice(sheet) && (
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
              Square sheet: choose Length or Width for the grain. Check which edge the face grain
              parallels; it isn&apos;t standard on square sheets.
            </p>
          )}
          {sheet.grainDirection !== 'none' && sheet.length > 0 && sheet.length === sheet.width && (
            <p className="text-[11px] text-muted-foreground">
              Square sheet: &ldquo;length&rdquo; is the left-to-right edge in the layout.
              Check which edge the face grain parallels before cutting.
            </p>
          )}

          {/* Edge trim toggle */}
          <button
            onClick={() => setExpandedTrim(expandedTrim === sheet.id ? null : sheet.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            {expandedTrim === sheet.id ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Edge Trim
          </button>

          {expandedTrim === sheet.id && (
            <div className="pt-1 border-t border-border space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {(['trimTop', 'trimRight', 'trimBottom', 'trimLeft'] as const).map((side) => (
                  <div key={side}>
                    <label className="field-label">{side.replace('trim', '')}</label>
                    <NumberInput
                      value={sheet[side]}
                      onChange={(v) => updateStockSheet(sheet.id, { [side]: v })}
                      placeholder="0"
                      units={units}
                      max={MAX_DIMENSION}
                      aria-label={`${sheet.label || `Sheet ${idx + 1}`} ${side.replace('trim', '')} trim`}
                    />
                  </div>
                ))}
              </div>
              {(sheet.trimLeft + sheet.trimRight >= sheet.length ||
                sheet.trimTop + sheet.trimBottom >= sheet.width) && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  ⚠ Trim exceeds sheet dimensions — no usable area remains.
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={() => addStockSheet()}
        className="w-full h-9 rounded-xl border-2 border-dashed border-border text-xs font-semibold text-muted-foreground
                   hover:border-primary hover:text-primary hover:bg-accent
                   transition-all flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Stock Sheet
      </button>
    </div>
  );
}
