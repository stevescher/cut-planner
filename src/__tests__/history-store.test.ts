import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore, type HistoryEntry } from '@/store/useHistoryStore';

// Minimal HistoryEntry factory — the store only cares about the shape, not the
// solution contents, so a labelled index is enough to track which state is live.
function entry(tag: number): HistoryEntry {
  return { solutions: [], activeSolutionIndex: tag };
}

/** Which state a returned entry represents, or -1 for "no change / null". */
function tagOf(e: HistoryEntry | null): number {
  return e ? e.activeSolutionIndex : -1;
}

describe('useHistoryStore undo/redo', () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
  });

  it('redo restores the state that undo left behind (A -> B -> undo -> redo === B)', () => {
    const store = useHistoryStore.getState();
    // Edit A -> B: the call sites push the *current* (A) before mutating to B.
    store.pushState(entry(0)); // A snapshotted before becoming B

    // Live state is now B. Undo, handing in the live state (B).
    const undone = store.undo(entry(1));
    expect(tagOf(undone)).toBe(0); // restored A
    expect(useHistoryStore.getState().canRedo()).toBe(true);

    // Live state is now A. Redo, handing in the live state (A).
    const redone = useHistoryStore.getState().redo(entry(0));
    expect(tagOf(redone)).toBe(1); // restored B — the previously-broken case
  });

  it('is lossless across multi-step navigation (A -> B -> C -> undo x2 -> redo x2 === C)', () => {
    const store = useHistoryStore.getState();
    store.pushState(entry(0)); // A, before B
    store.pushState(entry(1)); // B, before C
    // Live = C (tag 2).

    let live = 2;
    let e = useHistoryStore.getState().undo(entry(live)); // -> B
    expect(tagOf(e)).toBe(1);
    live = 1;
    e = useHistoryStore.getState().undo(entry(live)); // -> A
    expect(tagOf(e)).toBe(0);
    live = 0;

    e = useHistoryStore.getState().redo(entry(live)); // -> B
    expect(tagOf(e)).toBe(1);
    live = 1;
    e = useHistoryStore.getState().redo(entry(live)); // -> C
    expect(tagOf(e)).toBe(2);
  });

  it('a fresh pushState clears the redo stack', () => {
    const store = useHistoryStore.getState();
    store.pushState(entry(0));
    store.undo(entry(1)); // now redo-able
    expect(useHistoryStore.getState().canRedo()).toBe(true);

    useHistoryStore.getState().pushState(entry(5)); // a new edit branches history
    expect(useHistoryStore.getState().canRedo()).toBe(false);
  });

  it('undo/redo are no-ops when their stacks are empty', () => {
    const store = useHistoryStore.getState();
    expect(store.undo(entry(9))).toBeNull();
    expect(store.redo(entry(9))).toBeNull();
    // No spurious state was created.
    expect(useHistoryStore.getState().canUndo()).toBe(false);
    expect(useHistoryStore.getState().canRedo()).toBe(false);
  });
});
