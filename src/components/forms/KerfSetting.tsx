'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { NumberInput } from './NumberInput';
import { Units, defaultKerf } from '@/lib/fractions';

export function KerfSetting() {
  const { kerf, setKerf, units, setUnits } = useProjectStore();

  const handleUnitChange = (newUnits: Units) => {
    setUnits(newUnits);
    // Snap kerf to a sensible default for the new unit system
    setKerf(defaultKerf(newUnits));
  };

  const hint = units === 'metric'
    ? 'Typical table saw: 3 mm'
    : 'Fractions (1/8) or decimals (0.125)';

  return (
    <div className="space-y-2.5">
      {/* Unit toggle */}
      <div className="flex items-center gap-2">
        <span className="field-label shrink-0">Units</span>
        <div className="flex items-center rounded-lg bg-slate-100 p-0.5 gap-px">
          {(['imperial', 'metric'] as Units[]).map((u) => (
            <button
              key={u}
              onClick={() => handleUnitChange(u)}
              className={[
                'px-3 h-7 rounded-md text-xs font-semibold capitalize transition-all',
                units === u
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {u === 'imperial' ? 'Imperial (in)' : 'Metric (mm)'}
            </button>
          ))}
        </div>
      </div>

      {/* Kerf input */}
      <div className="flex items-center gap-3">
        <div className="w-24 shrink-0">
          <NumberInput
            value={kerf}
            onChange={setKerf}
            placeholder={units === 'metric' ? '3' : '1/8'}
            units={units}
          />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-600">Blade kerf</p>
          <p className="text-[11px] text-slate-400">{hint}</p>
        </div>
      </div>
    </div>
  );
}
