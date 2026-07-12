'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, ThemePref } from '@/store/useThemeStore';

const NEXT_LABEL: Record<ThemePref, string> = {
  light: 'Switch to dark theme',
  dark: 'Switch to system theme',
  system: 'Switch to light theme',
};

const ICON: Record<ThemePref, React.ElementType> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** True only after the first client render, so we can defer reflecting the
 *  persisted preference until hydration is done (avoids a mismatch — the server
 *  can't know the stored/OS preference). */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Header control that cycles light → dark → system. */
export function ThemeToggle() {
  const { pref, cycle, init } = useThemeStore();
  const hydrated = useHydrated();

  useEffect(() => init(), [init]);

  // Before hydration, render a stable default so server and client HTML match.
  const shown: ThemePref = hydrated ? pref : 'system';
  const Icon = ICON[shown];

  return (
    <button
      onClick={cycle}
      title={NEXT_LABEL[shown]}
      aria-label={NEXT_LABEL[shown]}
      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground
                 hover:bg-muted hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
