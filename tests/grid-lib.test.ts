import { describe, expect, it } from 'vitest';
import {
  buildGridWordLists,
  carveSections,
  countSolutions,
  encodePuzzle,
  fillShape,
  PatternIndex,
  randomShape,
  shapeProblems,
  TWO_LETTER_ANSWERS,
} from '../scripts/grid-lib';
import { findRuns, readPuzzle } from '../src/grid/puzzle';
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

/**
 * A 2×2 box, "ab / cd": ab, cd across and ac, bd down. With one section per column (a and c, b and d), flipping
 * both columns gives "cd / ab", which also works when ca and db are words.
 */
const ALL_OPEN = [true, true, true, true];
const ABCD = ['a', 'b', 'c', 'd'];
const COLUMNS = [0, 1, 0, 1];
const ONE_WAY = new PatternIndex(['ab', 'cd', 'ac', 'bd']);
const TWO_WAYS = new PatternIndex(['ab', 'cd', 'ac', 'bd', 'ca', 'db']);

describe('counting answers', () => {
  it('finds one answer when only one arrangement spells words', () => {
    expect(countSolutions(ALL_OPEN, 2, COLUMNS, ABCD, ONE_WAY)).toBe(1);
  });

  it('finds two answers when the letters can be swapped around', () => {
    expect(countSolutions(ALL_OPEN, 2, COLUMNS, ABCD, TWO_WAYS)).toBe(2);
  });

  it('finds one answer when every square is its own section', () => {
    expect(countSolutions(ALL_OPEN, 2, [0, 1, 2, 3], ABCD, TWO_WAYS)).toBe(1);
  });

  it('stops counting at the limit', () => {
    expect(countSolutions(ALL_OPEN, 2, COLUMNS, ABCD, TWO_WAYS, 1)).toBe(1);
  });
});

describe('carving sections', () => {
  it('merges sections as far as it can while there is still one answer', () => {
    const sectionOf = carveSections(ALL_OPEN, 2, ABCD, TWO_WAYS, 4, seededRandom(1));
    expect(countSolutions(ALL_OPEN, 2, sectionOf, ABCD, TWO_WAYS)).toBe(1);
    expect(new Set(sectionOf).size).toBe(2);
  });

  it('never makes a section bigger than the limit', () => {
    const open = shapeOf(['####', '##.#', '####', '##.#']);
    const answer = [...'gnatno.aantswe.k'].map((ch) => (ch === '.' ? '' : ch));
    const words = new PatternIndex(['gnat', 'no', 'ants', 'we', 'gnaw', 'none', 'task']);
    const sectionOf = carveSections(open, 4, answer, words, 3, seededRandom(2));
    const shape = readPuzzle(encodePuzzle(4, answer, sectionOf));
    expect(Math.max(...shape.sections.map((s) => s.length))).toBeLessThanOrEqual(3);
    expect(countSolutions(open, 4, sectionOf, answer, words)).toBe(1);
  });
});

describe('storing a puzzle', () => {
  it('letters its sections a, b, c… in order of first appearance', () => {
    expect(encodePuzzle(2, ['a', 'b', '', 'd'], [5, 2, -1, 2])).toEqual({ size: 2, cells: 'ab.d', sections: 'ab.b' });
  });
});
