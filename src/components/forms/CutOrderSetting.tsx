'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { CutPreference } from '@/lib/optimizer/types';

/** Option labels and the one-line explanation shown under the control. */
export const CUT_PREFERENCE_OPTIONS: Array<{ value: CutPreference; label: string; hint: string }> = [
  {
    value: 'auto',
    label: 'Auto',
    hint: 'Picks whichever first cut gives the best layout.',
  },
  {
    value: 'favor-rip',
    label: 'Favor rip-first',
    hint: 'Prefers layouts that start with full-length rips, but never uses an extra sheet for it.',
  },
  {
    value: 'always-rip',
    label: 'Always rip-first',
    hint: 'After any edge trims, every sheet starts with a full-length rip, even if that costs material.',
  },
  {
    value: 'favor-crosscut',
    label: 'Favor crosscut-first',
    hint: 'Prefers layouts that start with full-width crosscuts, but never uses an extra sheet for it.',
  },
  {
    value: 'always-crosscut',
    label: 'Always crosscut-first',
    hint: 'After any edge trims, every sheet starts with a full-width crosscut, even if that costs material.',
  },
];

export function cutPreferenceLabel(pref: CutPreference): string {
  return CUT_PREFERENCE_OPTIONS.find((o) => o.value === pref)?.label ?? pref;
}

export function CutOrderSetting() {
  const { cutPreference, setCutPreference } = useProjectStore();
  const current = CUT_PREFERENCE_OPTIONS.find((o) => o.value === cutPreference) ?? CUT_PREFERENCE_OPTIONS[0];

  return (
    <div className="space-y-1">
      <label htmlFor="cut-order" className="field-label">First cut</label>
      <select
        id="cut-order"
        value={cutPreference}
        onChange={(e) => setCutPreference(e.target.value as CutPreference)}
        aria-describedby="cut-order-hint"
        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground
                   focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {CUT_PREFERENCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p id="cut-order-hint" className="text-[11px] text-muted-foreground">
        {current.hint} Rips run along the sheet&apos;s length.
      </p>
    </div>
  );
}
