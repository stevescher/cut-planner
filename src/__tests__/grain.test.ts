import { describe, it, expect } from 'vitest';
import {
  allowedOrientations,
  canRotatePlacement,
  isGrainViolation,
  sheetGrainAxis,
  sheetHasGrain,
  solverOrientations,
} from '@/lib/grain';
import { SheetGrain } from '@/lib/optimizer/types';

const sheet = (grainDirection: SheetGrain) => ({ grainDirection });
const placed = (rotated: boolean) => ({ rotated });

describe('sheetGrainAxis / sheetHasGrain', () => {
  it('maps length to x, width to y, and none to null', () => {
    expect(sheetGrainAxis(sheet('length'))).toBe('x');
    expect(sheetGrainAxis(sheet('width'))).toBe('y');
    expect(sheetGrainAxis(sheet('none'))).toBeNull();
  });

  it('reports grain only for length and width', () => {
    expect(sheetHasGrain(sheet('length'))).toBe(true);
    expect(sheetHasGrain(sheet('width'))).toBe(true);
    expect(sheetHasGrain(sheet('none'))).toBe(false);
  });
});

describe('allowedOrientations', () => {
  it('follow on a length-grain sheet keeps the part unrotated', () => {
    expect(allowedOrientations('follow', sheet('length'))).toEqual({ normal: true, rotated: false });
  });

  it('follow on a width-grain sheet requires rotation (the old lock ignored this)', () => {
    expect(allowedOrientations('follow', sheet('width'))).toEqual({ normal: false, rotated: true });
  });

  it('across is the opposite of follow', () => {
    expect(allowedOrientations('across', sheet('length'))).toEqual({ normal: false, rotated: true });
    expect(allowedOrientations('across', sheet('width'))).toEqual({ normal: true, rotated: false });
  });

  it('any panel, or any grainless sheet, allows both', () => {
    expect(allowedOrientations('any', sheet('length'))).toEqual({ normal: true, rotated: true });
    expect(allowedOrientations('follow', sheet('none'))).toEqual({ normal: true, rotated: true });
    expect(allowedOrientations('across', sheet('none'))).toEqual({ normal: true, rotated: true });
  });
});

describe('solverOrientations', () => {
  it('lets a no-rotation strategy narrow a free choice', () => {
    expect(solverOrientations('any', sheet('none'), false)).toEqual({ normal: true, rotated: false });
  });

  it('never lets a no-rotation strategy override a grain requirement', () => {
    expect(solverOrientations('follow', sheet('width'), false)).toEqual({ normal: false, rotated: true });
  });
});

describe('isGrainViolation / canRotatePlacement', () => {
  it('flags a follow part laid across a length-grain sheet', () => {
    expect(isGrainViolation(placed(true), 'follow', sheet('length'))).toBe(true);
    expect(isGrainViolation(placed(false), 'follow', sheet('length'))).toBe(false);
  });

  it('never flags an any part or a grainless sheet', () => {
    expect(isGrainViolation(placed(true), 'any', sheet('length'))).toBe(false);
    expect(isGrainViolation(placed(true), 'follow', sheet('none'))).toBe(false);
  });

  it('blocks rotating a correctly placed constrained part', () => {
    expect(canRotatePlacement(placed(false), 'follow', sheet('length'))).toBe(false);
  });

  it('allows rotating a misplaced part back into line', () => {
    expect(canRotatePlacement(placed(true), 'follow', sheet('length'))).toBe(true);
  });

  it('allows rotating free parts', () => {
    expect(canRotatePlacement(placed(false), 'any', sheet('width'))).toBe(true);
    expect(canRotatePlacement(placed(false), 'follow', sheet('none'))).toBe(true);
  });
});
