'use client';

import { useProjectStore } from '@/store/useProjectStore';
import { Units, defaultKerf } from '@/lib/fractions';

export function UnitToggle() {
  const { units, kerf, setUnits, setKerf } = useProjectStore();

  const handleChange = (newUnits: Units) => {
    if (newUnits === units) return;
    // Kerf is stored in inches, so it carries across unit systems unchanged.
    // Only swap to the new system's default kerf when the user hasn't set a
    // custom one (i.e. it still equals the old system's default) — otherwise a
    // deliberately-chosen blade width would be silently discarded.
    if (Math.abs(kerf - defaultKerf(units)) < 1e-6) {
      setKerf(defaultKerf(newUnits));
    }
    setUnits(newUnits);
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
            {u === 'imperial' ? 'Imperial' : 'Metric'}
            <span className="ml-1 opacity-60">{u === 'imperial' ? 'in' : 'mm'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
