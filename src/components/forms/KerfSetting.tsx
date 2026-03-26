'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { NumberInput } from './NumberInput';

export function KerfSetting() {
  const { kerf, setKerf } = useProjectStore();

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0">
        <NumberInput
          value={kerf}
          onChange={setKerf}
          placeholder="1/8"
          fractional
        />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-600">Blade kerf in inches</p>
        <p className="text-[11px] text-slate-400">Fractions (1/8) or decimals (0.125)</p>
      </div>
    </div>
  );
}
