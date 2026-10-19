import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../src/game/types';
import { seededRandom } from '../src/shared/random';
import {
  buildPuzzles,
  canForm,
  letterCounts,
  pickWords,
  scrambleLetters,
  spellsClockwise,
  validatePuzzle,
  type BuildOptions,
  type PuzzleShape,
} from '../scripts/puzzle-lib';

const ANSWERS = new Map<string, number>([
  ['stone', 10], ['notes', 20], ['tones', 20], ['onset', 35],
  ['one', 10], ['ten', 10], ['toe', 10], ['net', 10], ['not', 10], ['note', 10], ['tone', 10],
  ['nest', 20], ['son', 20], ['ton', 20], ['eon', 35], ['snot', 35],
  ['plant', 10], ['plan', 10], ['ant', 10], ['pan', 10], ['tan', 10], ['lap', 10], ['pat', 10],
  ['planet', 10], ['plane', 10], ['plate', 10], ['lane', 10], ['late', 10], ['pale', 20],
  ['quiz', 10], ['jazz', 10], ['fizzy', 20],
]);
const ACCEPTED = new Set([...ANSWERS.keys(), 'pelt', 'leant', 'tenon']);
const BLOCKLIST = new Set(['snot']);
const MEDIUM: PuzzleShape = { letterCount: 5, minWords: 4, maxWords: 6 };

const options = (overrides: Partial<BuildOptions> = {}): BuildOptions => ({
  answers: ANSWERS,
  accepted: ACCEPTED,
  blocklist: BLOCKLIST,
  random: seededRandom(1),
  ...MEDIUM,
  target: 10,
  ...overrides,
});

describe('letter helpers', () => {
  it('checks whether a word can be made from the letters', () => {
    const stone = letterCounts('stone');
    expect(canForm('note', stone)).toBe(true);
    expect(canForm('noon', stone)).toBe(false);
    expect(canForm('tess', stone)).toBe(false);
  });

  it('detects a word spelled clockwise from any starting letter', () => {
    expect(spellsClockwise(['n', 'e', 's', 't', 'o'], 'stone')).toBe(true);
    expect(spellsClockwise(['s', 'o', 't', 'n', 'e'], 'stone')).toBe(false);
  });

  it('scrambles letters without spelling any full-length answer clockwise', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const letters = scrambleLetters('stone', ['stone', 'notes'], seededRandom(seed))!;
      expect([...letters].sort()).toEqual([...'stone'].sort());
      expect(spellsClockwise(letters, 'stone')).toBe(false);
      expect(spellsClockwise(letters, 'notes')).toBe(false);
    }
  });

  it('gives up when every arrangement spells an answer', () => {
    expect(scrambleLetters('loop', ['loop', 'polo', 'pool'], seededRandom(1))).toBeNull();
  });
});

describe('pickWords', () => {
  const formable: Array<[string, number]> = [
    ['stone', 10], ['notes', 20], ['tones', 20], ['onset', 35], ['one', 10], ['ten', 10], ['toe', 10],
    ['net', 10], ['not', 10], ['note', 10], ['tone', 10], ['nest', 20], ['son', 20], ['ton', 20], ['eon', 35],
  ];

  it('keeps the base word, covers each length, then the most common words, up to the limit', () => {
    expect(pickWords('stone', formable, 6)).toEqual(['net', 'not', 'one', 'note', 'notes', 'stone']);
  });

  it('respects a smaller limit', () => {
    expect(pickWords('stone', formable, 4)).toEqual(['net', 'note', 'notes', 'stone']);
  });
});

describe('buildPuzzles', () => {
  const puzzles = buildPuzzles(options());

  it('makes one puzzle per letter set of the right size and skips sets with too few words', () => {
    expect(puzzles.map((p) => p.id).sort()).toEqual(['aelnp', 'aelpt', 'alnpt', 'enost']);
  });

  it('skips letter sets whose every arrangement spells an answer', () => {
    const loop = new Map<string, number>([['loop', 10], ['polo', 10], ['pool', 10], ['lop', 10]]);
    expect(buildPuzzles(options({ answers: loop, letterCount: 4, minWords: 3, maxWords: 4 }))).toEqual([]);
  });

  it('builds other sizes too', () => {
    const six = buildPuzzles(options({ letterCount: 6 }));
    expect(six.map((p) => p.id)).toEqual(['aelnpt']);
  });

  it('produces puzzles that pass validation', () => {
    for (const puzzle of puzzles) expect(validatePuzzle(puzzle, BLOCKLIST, MEDIUM)).toEqual([]);
  });

  it('never uses never-use words', () => {
    for (const puzzle of puzzles) expect([...puzzle.words, ...puzzle.bonus]).not.toContain('snot');
  });

  it('turns extra common words into bonus words', () => {
    const plant = puzzles.find((p) => p.id === 'alnpt')!;
    expect(plant.words).toEqual(['ant', 'lap', 'pan', 'pat', 'plan', 'plant']);
    expect(plant.bonus).toContain('tan');
  });

  it('gives credit for accepted words that are not answers', () => {
    const planet = buildPuzzles(options({ letterCount: 6 }))[0];
    expect(planet.bonus).toEqual(expect.arrayContaining(['leant', 'pelt']));
    expect(planet.bonus).not.toContain('tenon');
  });

  it('caps the number of words per puzzle', () => {
    const small = buildPuzzles(options({ minWords: 3, maxWords: 4 }));
    for (const puzzle of small) expect(puzzle.words.length).toBeLessThanOrEqual(4);
  });

  it('respects the target', () => {
    expect(buildPuzzles(options({ target: 1 }))).toHaveLength(1);
  });

  it('is reproducible for the same seed', () => {
    expect(buildPuzzles(options())).toEqual(buildPuzzles(options()));
  });
});

describe('validatePuzzle', () => {
  const GOOD: Puzzle = {
    id: 'enost',
    letters: ['n', 's', 'e', 'o', 't'],
    words: ['net', 'not', 'one', 'note', 'notes', 'stone'],
    bonus: ['eon', 'nest', 'onset', 'son', 'ten', 'toe', 'ton', 'tone', 'tones'],
  };
  const problemsFor = (puzzle: Puzzle) => validatePuzzle(puzzle, BLOCKLIST, MEDIUM).join('\n');

  it('accepts a good puzzle', () => {
    expect(validatePuzzle(GOOD, BLOCKLIST, MEDIUM)).toEqual([]);
  });

  it('flags each kind of problem', () => {
    expect(problemsFor({ ...GOOD, words: ['net', 'not', 'stone'] })).toContain('has 3 words');
    expect(problemsFor({ ...GOOD, bonus: [...GOOD.bonus, 'noon'] })).toContain('"noon" cannot be made');
    expect(problemsFor({ ...GOOD, bonus: [...GOOD.bonus, 'snot'] })).toContain('"snot" is on the never-use list');
    expect(problemsFor({ ...GOOD, letters: ['s', 't', 'o', 'n', 'e'] })).toContain('circle spells "stone"');
    expect(problemsFor({ ...GOOD, words: ['note', 'net', 'not', 'one', 'notes', 'stone'] })).toContain('slot order');
    expect(problemsFor({ ...GOOD, id: 'abcde' })).toContain('does not match');
    expect(problemsFor({ ...GOOD, words: ['net', 'not', 'one', 'note'] })).toContain('no word uses every letter');
  });

  it('flags the wrong number of letters for the level', () => {
    expect(validatePuzzle(GOOD, BLOCKLIST, { ...MEDIUM, letterCount: 6 }).join('\n')).toContain('has 5 letters (needs 6)');
  });
});
