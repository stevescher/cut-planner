import { create } from 'zustand';

export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cut-planner-theme';

/** Whether the OS currently prefers dark. Guarded — matchMedia can be absent
 *  or throw in embedded/test browsers. Falls back to light. */
function osPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Resolve a preference to the actual mode, consulting the OS for 'system'. */
function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') return osPrefersDark() ? 'dark' : 'light';
  return pref;
}

/** Apply the resolved mode to <html> by toggling the `dark` class. */
function apply(pref: ThemePref) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolve(pref) === 'dark');
}

function readStored(): ThemePref {
  // Access can throw (Safari private mode, storage disabled) — treat any failure
  // as "no stored preference" and fall back to 'system'.
  try {
    if (typeof localStorage === 'undefined') return 'system';
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

interface ThemeState {
  /** The user's stored preference. */
  pref: ThemePref;
  /** Set and persist the preference, applying it immediately. */
  setPref: (pref: ThemePref) => void;
  /** Cycle light → dark → system → light (used by the header toggle). */
  cycle: () => void;
  /** Sync store state from storage + apply, and start watching the OS setting.
   *  Returns a cleanup function. Call once on mount. */
  init: () => () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  pref: 'system',

  setPref: (pref) => {
    // Persisting is best-effort — a blocked/full store shouldn't break theming.
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* ignore — theme still applies for this session */
    }
    apply(pref);
    set({ pref });
  },

  cycle: () => {
    const order: ThemePref[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(get().pref) + 1) % order.length];
    get().setPref(next);
  },

  init: () => {
    const pref = readStored();
    apply(pref);
    set({ pref });
    // When on 'system', follow live OS changes. matchMedia may be unavailable
    // or throw in embedded/test browsers — degrade to a no-op cleanup.
    try {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {};
      }
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (get().pref === 'system') apply('system');
      };
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } catch {
      return () => {};
    }
  },
}));
