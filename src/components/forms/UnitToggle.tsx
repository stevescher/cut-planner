'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { Units, defaultKerf } from '@/lib/fractions';

export function UnitToggle() {
  const { units, setUnits, setKerf } = useProjectStore();

  const handleChange = (newUnits: Units) => {
    setUnits(newUnits);
    setKerf(defaultKerf(newUnits));
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Units</span>
      <div className="flex items-center rounded-lg bg-white border border-slate-200 p-0.5 gap-px shadow-sm">
        {(['imperial', 'metric'] as Units[]).map((u) => (
          <button
            key={u}
            onClick={() => handleChange(u)}
            className={[
              'px-3 h-7 rounded-md text-xs font-semibold transition-all',
              units === u
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {u === 'imperial' ? 'Imperial  in' : 'Metric  mm'}
          </button>
        ))}
      </div>
    </div>
  );
}
