import { describe, it, expect, beforeEach } from 'vitest';
import { useDragStore } from '@/store/useDragStore';

// Pins are keyed by placement index ("stockSheetId-sheetIndex:placementIndex").
// That identity is only valid for one layout; any event that rebuilds placement
// arrays (fresh plan, re-plan, undo/redo, project reset/import) must clear pins
// so a stale index key can't anchor the wrong piece. (OPUS-402)

describe('useDragStore pins', () => {
  beforeEach(() => {
    useDragStore.getState().clearPins();
  });

  it('togglePin adds then removes a pin by sheetKey + index', () => {
    const s = useDragStore.getState();
    s.togglePin('stock1-0', 2);
    expect(useDragStore.getState().isPinned('stock1-0', 2)).toBe(true);
    expect(useDragStore.getState().pinnedPieces.size).toBe(1);

    useDragStore.getState().togglePin('stock1-0', 2);
    expect(useDragStore.getState().isPinned('stock1-0', 2)).toBe(false);
    expect(useDragStore.getState().pinnedPieces.size).toBe(0);
  });

  it('clearPins empties the whole set (used by every layout-replacement path)', () => {
    const s = useDragStore.getState();
    s.togglePin('stock1-0', 0);
    s.togglePin('stock1-0', 1);
    s.togglePin('stock2-1', 0);
    expect(useDragStore.getState().pinnedPieces.size).toBe(3);

    useDragStore.getState().clearPins();
    expect(useDragStore.getState().pinnedPieces.size).toBe(0);
  });

  it('a stale index key does not falsely match after clearPins', () => {
    // Pin index 2, then clear (simulating a re-plan). The same key must no
    // longer report as pinned — the crux of the OPUS-402 bug.
    useDragStore.getState().togglePin('stock1-0', 2);
    expect(useDragStore.getState().isPinned('stock1-0', 2)).toBe(true);

    useDragStore.getState().clearPins();
    expect(useDragStore.getState().isPinned('stock1-0', 2)).toBe(false);
  });
});
