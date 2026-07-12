import { describe, it, expect } from 'vitest';
import { pieceGrainAxis, sheetGrainAxis, isGrainMismatch, isGrainCrossed } from '@/lib/grain';
import { Placement, StockSheet } from '@/lib/optimizer/types';

function placement(rotated: boolean): Placement {
  return {
    panelId: 'p',
    label: 'p',
    x: 0,
    y: 0,
    width: 10,
    height: 5,
    rotated,
    pinned: false,
    color: '#000',
  };
}

function sheet(grainDirection?: 'length' | 'width'): StockSheet {
  return {
    id: 's',
    label: 's',
    length: 96,
    width: 48,
    quantity: 1,
    trimTop: 0,
    trimRight: 0,
    trimBottom: 0,
    trimLeft: 0,
    grainDirection,
  };
}

describe('sheetGrainAxis', () => {
  it('defaults to the length axis (x) when unset', () => {
    expect(sheetGrainAxis(sheet(undefined))).toBe('x');
  });
  it("maps 'length' to x and 'width' to y", () => {
    expect(sheetGrainAxis(sheet('length'))).toBe('x');
    expect(sheetGrainAxis(sheet('width'))).toBe('y');
  });
});

describe('pieceGrainAxis', () => {
  it('runs along x for an unrotated piece (panel length on the x axis)', () => {
    expect(pieceGrainAxis(placement(false))).toBe('x');
  });
  it('runs along y for a rotated piece', () => {
    expect(pieceGrainAxis(placement(true))).toBe('y');
  });
});

describe('isGrainCrossed (geometric only)', () => {
  it('not crossed: unrotated piece on a length-grain sheet (both x)', () => {
    expect(isGrainCrossed(placement(false), sheet('length'))).toBe(false);
  });
  it('crossed: rotated piece on a length-grain sheet (y vs x)', () => {
    expect(isGrainCrossed(placement(true), sheet('length'))).toBe(true);
  });
  it('not crossed: rotated piece on a width-grain sheet (both y)', () => {
    expect(isGrainCrossed(placement(true), sheet('width'))).toBe(false);
  });
  it('crossed: unrotated piece on a width-grain sheet (x vs y)', () => {
    expect(isGrainCrossed(placement(false), sheet('width'))).toBe(true);
  });
  it('treats an unset sheet grain as length (x)', () => {
    expect(isGrainCrossed(placement(false), sheet(undefined))).toBe(false);
    expect(isGrainCrossed(placement(true), sheet(undefined))).toBe(true);
  });
});

describe('isGrainMismatch (UI flag)', () => {
  it('flags a cross-grain piece that the user can rotate (unlocked)', () => {
    expect(isGrainMismatch(placement(true), sheet('length'), false)).toBe(true);
  });

  it('does NOT flag a cross-grain piece when rotation is locked', () => {
    // Codex finding: a locked panel on a width-grain sheet sits cross-grain but
    // its rotate control is disabled — flagging it would be an unfixable false
    // alarm. The lock is the user's explicit grain decision.
    expect(isGrainMismatch(placement(false), sheet('width'), true)).toBe(false);
    expect(isGrainMismatch(placement(true), sheet('length'), true)).toBe(false);
  });

  it('does not flag an aligned piece regardless of lock', () => {
    expect(isGrainMismatch(placement(false), sheet('length'), false)).toBe(false);
    expect(isGrainMismatch(placement(false), sheet('length'), true)).toBe(false);
  });
});
