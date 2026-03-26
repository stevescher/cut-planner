'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { NumberInput } from './NumberInput';

export function KerfSetting() {
  const { kerf, setKerf } = useProjectStore();

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-foreground whitespace-nowrap">
        Blade Kerf
      </label>
      <div className="w-24">
        <NumberInput
          value={kerf}
          onChange={setKerf}
          placeholder='1/8"'
          fractional
        />
      </div>
      <span className="text-xs text-muted-foreground">inches</span>
    </div>
  );
}
