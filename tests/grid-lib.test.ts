import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildGridWordLists,
  buildLevel,
  carveSections,
  countSolutions,
  encodePuzzle,
  fillShape,
  levelProblems,
  PatternIndex,
  puzzleProblems,
  randomShape,
  shapeProblems,
  solveByWords,
  TWO_LETTER_ANSWERS,
  wordsByLength,
} from '../scripts/grid-lib';
import { readScowl } from '../scripts/scowl';
import { findRuns, readPuzzle } from '../src/grid/puzzle';
import type { GridPuzzle } from '../src/grid/types';
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

const GNAT: GridPuzzle = { size: 4, cells: 'gnatno.aantswe.k', sections: 'aabbaa.cdddcee.c' };
const GNAT_WORDS = ['gnat', 'no', 'ants', 'we', 'gnaw', 'none', 'task'];

describe('the independent solver', () => {
  it('finds the one answer', () => {
    expect(solveByWords(GNAT, wordsByLength(GNAT_WORDS))).toEqual([GNAT.cells]);
  });

  it('finds both answers when there are two', () => {
    const puzzle = encodePuzzle(2, ABCD, COLUMNS);
    const byLength = wordsByLength(['ab', 'cd', 'ac', 'bd', 'ca', 'db']);
    expect(solveByWords(puzzle, byLength).sort()).toEqual(['abcd', 'cdab']);
  });

  it('agrees with countSolutions on random small puzzles', () => {
    const words = ['ab', 'ba', 'cd', 'dc', 'ac', 'ca', 'bd', 'db', 'ad', 'da'];
    const index = new PatternIndex(words);
    const byLength = wordsByLength(words);
    const random = seededRandom(11);
    let checked = 0;
    for (let i = 0; i < 30; i++) {
      const sectionOf = ALL_OPEN.map(() => Math.floor(random() * 2));
      const answer = fillShape(ALL_OPEN, 2, index, random);
      if (!answer) continue;
      const puzzle = encodePuzzle(2, answer, sectionOf);
      expect(solveByWords(puzzle, byLength, 3).length).toBe(countSolutions(ALL_OPEN, 2, sectionOf, answer, index, 3));
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe('the build checks', () => {
  const rules = { size: 4, maxSection: 4 };
  const answers = new Set(GNAT_WORDS);
  const byLength = wordsByLength(GNAT_WORDS);

  it('passes a good puzzle', () => {
    expect(puzzleProblems(GNAT, rules, answers, byLength)).toEqual([]);
  });

  it('catches a section that is too big, a word that is not an answer, and a section in pieces', () => {
    expect(puzzleProblems(GNAT, { size: 4, maxSection: 3 }, answers, byLength)).toContain(
      'gnatno.aantswe.k: section a is too big',
    );
    const noTask = new Set(GNAT_WORDS.filter((w) => w !== 'task'));
    expect(puzzleProblems(GNAT, rules, noTask, byLength)).toContain('gnatno.aantswe.k: "task" is not an answer word');
    const split = { size: 2, cells: 'abcd', sections: 'abba' };
    const fourWords = ['ab', 'cd', 'ac', 'bd'];
    expect(puzzleProblems(split, { size: 2, maxSection: 4 }, new Set(fourWords), wordsByLength(fourWords))).toContain(
      'abcd: section a is in pieces',
    );
  });

  it('catches a puzzle with two answers and a repeated word', () => {
    const two = encodePuzzle(2, ABCD, COLUMNS);
    const twoWords = ['ab', 'cd', 'ac', 'bd', 'ca', 'db'];
    expect(puzzleProblems(two, { size: 2, maxSection: 4 }, new Set(twoWords), wordsByLength(twoWords))).toContain(
      'abcd: has 2 answers',
    );
    const same = { size: 2, cells: 'aaaa', sections: 'aaaa' };
    expect(puzzleProblems(same, { size: 2, maxSection: 4 }, new Set(['aa']), wordsByLength(['aa']))).toContain(
      'aaaa: repeats a word',
    );
  });

  it('catches repeated puzzles and too few puzzles in a level', () => {
    expect(levelProblems('easy', [GNAT, GNAT], 1)).toEqual(['easy: gnatno.aantswe.k appears twice']);
    expect(levelProblems('easy', [GNAT], 2)).toEqual(['easy: only 1 puzzles could be made (need at least 2)']);
  });
});

describe('making real puzzles', () => {
  it('makes Easy puzzles from the real word lists that pass every check', { timeout: 60_000 }, () => {
    const scowl = fileURLToPath(new URL('../words/scowl/final', import.meta.url));
    const lists = buildGridWordLists({
      common: readScowl(scowl, 20).keys(),
      all: readScowl(scowl, 60).keys(),
      neverUse: new Set(),
      skip: new Set(),
    });
    const indexes = { answers: new PatternIndex(lists.answers), words: new PatternIndex(lists.words) };
    const rules = { size: 4, maxSection: 3 };
    const puzzles = buildLevel(rules, indexes, 5, seededRandom(5));
    expect(puzzles).toHaveLength(5);
    const answers = new Set(lists.answers);
    const byLength = wordsByLength(lists.words);
    for (const puzzle of puzzles) expect(puzzleProblems(puzzle, rules, answers, byLength)).toEqual([]);
  });
});
