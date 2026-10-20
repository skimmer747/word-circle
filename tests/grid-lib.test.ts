import { describe, expect, it } from 'vitest';
import {
  buildGridWordLists,
  fillShape,
  PatternIndex,
  randomShape,
  shapeProblems,
  TWO_LETTER_ANSWERS,
} from '../scripts/grid-lib';
import { findRuns } from '../src/grid/puzzle';
import { seededRandom } from '../src/shared/random';

/** "#" is an open square, "." a blocked one. */
const shapeOf = (rows: string[]) => [...rows.join('')].map((ch) => ch === '#');

describe('the Word Grid word lists', () => {
  const lists = buildGridWordLists({
    common: ['cat', 'dog', 'gun', 'damn'],
    all: ['cat', 'dog', 'gun', 'damn', 'zax'],
    neverUse: new Set(['damn']),
    skip: new Set(['gun']),
  });

  it('counts every real word, plus the two-letter words, but never a never-use word', () => {
    expect(lists.words).toEqual(expect.arrayContaining(['cat', 'dog', 'gun', 'zax', 'am', 'we', 'ad', 'ye']));
    expect(lists.words).not.toContain('damn');
    expect(lists.words).toEqual([...lists.words].sort());
  });

  it('makes answers from common words and everyday two-letter words, never touchy or never-use words', () => {
    expect(lists.answers).toEqual([...TWO_LETTER_ANSWERS, 'cat', 'dog'].sort());
  });
});

describe('the pattern index', () => {
  const index = new PatternIndex(['cat', 'cot', 'at']);

  it('knows whether a partly filled run can still become a word', () => {
    expect(index.has('cat')).toBe(true);
    expect(index.has('c.t')).toBe(true);
    expect(index.has('...')).toBe(true);
    expect(index.has('.a.')).toBe(true);
    expect(index.has('cab')).toBe(false);
    expect(index.has('d..')).toBe(false);
    expect(index.has('..')).toBe(true);
    expect(index.has('....')).toBe(false);
  });
});

describe('crossword shapes', () => {
  it('accepts a shape that is all one piece, uses every row and column, and has every square in a word', () => {
    expect(shapeProblems(shapeOf(['####', '##.#', '####', '##.#']), 4)).toEqual([]);
  });

  it('rejects an empty row, a shape in pieces, a square in no word, and too few or too many open squares', () => {
    expect(shapeProblems(shapeOf(['####', '####', '....', '####']), 4)).toEqual(
      expect.arrayContaining(['row 3 is empty', 'not all one piece']),
    );
    expect(shapeProblems(shapeOf(['#.##', '.###', '####', '####']), 4)).toContain('square 0 is in no word');
    expect(shapeProblems(shapeOf(['##..', '##..', '....', '....']), 4)).toContain('4 open squares');
    expect(shapeProblems(shapeOf(['####', '####', '####', '####']), 4)).toContain('16 open squares');
  });

  it('makes random shapes that follow the rules', () => {
    const random = seededRandom(7);
    for (const size of [4, 5, 6]) {
      for (let i = 0; i < 20; i++) expect(shapeProblems(randomShape(size, random), size)).toEqual([]);
    }
  });
});

describe('filling a shape', () => {
  it('fills every run with an answer word', () => {
    const answers = new PatternIndex(['ab', 'cd', 'ac', 'bd']);
    const letters = fillShape([true, true, true, true], 2, answers, seededRandom(1));
    const spelled = findRuns([true, true, true, true], 2).map((run) => run.map((s) => letters![s]).join(''));
    expect(spelled.sort()).toEqual(['ab', 'ac', 'bd', 'cd']);
  });

  it('never uses a word twice', () => {
    const answers = new PatternIndex(['aa']);
    expect(fillShape([true, true, true, true], 2, answers, seededRandom(1))).toBeNull();
  });

  it('gives up after its step budget', () => {
    const answers = new PatternIndex(['ab', 'cd', 'ac', 'bd']);
    expect(fillShape([true, true, true, true], 2, answers, seededRandom(1), 3)).toBeNull();
  });

  it('fills a real shape with real words', () => {
    const open = shapeOf(['####', '##.#', '####', '##.#']);
    const words = ['gnat', 'no', 'ants', 'we', 'gnaw', 'none', 'task'];
    const letters = fillShape(open, 4, new PatternIndex(words), seededRandom(3));
    expect(letters).not.toBeNull();
    const spelled = findRuns(open, 4).map((run) => run.map((s) => letters![s]).join(''));
    expect(spelled.sort()).toEqual([...words].sort());
  });
});
