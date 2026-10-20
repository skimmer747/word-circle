import { describe, expect, it } from 'vitest';
import { findRuns, readPuzzle } from '../src/grid/puzzle';
import type { GridPuzzle } from '../src/grid/types';

/**
 *   G N A T     a a b b
 *   N O . A     a a . c
 *   A N T S     d d d c
 *   W E . K     e e . c
 */
const PUZZLE: GridPuzzle = { size: 4, cells: 'gnatno.aantswe.k', sections: 'aabbaa.cdddcee.c' };

describe('reading a Word Grid puzzle', () => {
  const shape = readPuzzle(PUZZLE);

  it('knows which squares are open, in reading order', () => {
    expect(shape.size).toBe(4);
    expect(shape.squares).toEqual([0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 15]);
    expect(shape.open[6]).toBe(false);
    expect(shape.open[7]).toBe(true);
  });

  it('finds every run of two or more squares, across then down', () => {
    expect(shape.runs).toEqual([
      [0, 1, 2, 3],
      [4, 5],
      [8, 9, 10, 11],
      [12, 13],
      [0, 4, 8, 12],
      [1, 5, 9, 13],
      [3, 7, 11, 15],
    ]);
  });

  it('groups the squares into sections, each with its letters in alphabetical order', () => {
    expect(shape.sections).toEqual([[0, 1, 4, 5], [2, 3], [7, 11, 15], [8, 9, 10], [12, 13]]);
    expect(shape.letters).toEqual([['g', 'n', 'n', 'o'], ['a', 't'], ['a', 'k', 's'], ['a', 'n', 't'], ['e', 'w']]);
    expect(shape.sectionOf[6]).toBe(-1);
    expect(shape.sectionOf[15]).toBe(2);
  });

  it('knows the answer letter in each square', () => {
    expect(shape.answer.join('')).toBe('gnatnoaantswek');
    expect(shape.answer[6]).toBe('');
  });
});

describe('finding runs', () => {
  it('splits a line at a blocked square and skips single squares', () => {
    const open = [true, true, false, true, true, false, true, true, true];
    expect(findRuns(open, 3)).toEqual([[0, 1], [3, 4], [6, 7, 8], [0, 3, 6], [1, 4, 7]]);
  });
});
