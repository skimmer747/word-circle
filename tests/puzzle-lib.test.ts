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

const options = (overrides: Partial<BuildOptions> = {}): BuildOptions => ({
  answers: ANSWERS,
  accepted: ACCEPTED,
  blocklist: BLOCKLIST,
  random: seededRandom(1),
  fiveLetterTarget: 10,
  sixLetterTarget: 10,
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
      const letters = scrambleLetters('stone', ['stone', 'notes'], seededRandom(seed));
      expect([...letters].sort()).toEqual([...'stone'].sort());
      expect(spellsClockwise(letters, 'stone')).toBe(false);
      expect(spellsClockwise(letters, 'notes')).toBe(false);
    }
  });
});

describe('pickWords', () => {
  it('keeps the base word, covers each length, then the most common words, up to 6', () => {
    const formable: Array<[string, number]> = [
      ['stone', 10], ['notes', 20], ['tones', 20], ['onset', 35], ['one', 10], ['ten', 10], ['toe', 10],
      ['net', 10], ['not', 10], ['note', 10], ['tone', 10], ['nest', 20], ['son', 20], ['ton', 20], ['eon', 35],
    ];
    expect(pickWords('stone', formable)).toEqual(['net', 'not', 'one', 'note', 'notes', 'stone']);
  });
});

describe('buildPuzzles', () => {
  const puzzles = buildPuzzles(options());

  it('makes one puzzle per letter set and skips sets with fewer than 4 words', () => {
    expect(puzzles.map((p) => p.id).sort()).toEqual(['aelnp', 'aelnpt', 'aelpt', 'alnpt', 'enost']);
  });

  it('produces puzzles that pass validation', () => {
    for (const puzzle of puzzles) expect(validatePuzzle(puzzle, BLOCKLIST)).toEqual([]);
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
    const planet = puzzles.find((p) => p.id === 'aelnpt')!;
    expect(planet.bonus).toEqual(expect.arrayContaining(['leant', 'pelt']));
    expect(planet.bonus).not.toContain('tenon');
  });

  it('respects the per-length targets', () => {
    const limited = buildPuzzles(options({ fiveLetterTarget: 1, sixLetterTarget: 0 }));
    expect(limited).toHaveLength(1);
    expect(limited[0].letters).toHaveLength(5);
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
  const problemsFor = (puzzle: Puzzle) => validatePuzzle(puzzle, BLOCKLIST).join('\n');

  it('accepts a good puzzle', () => {
    expect(validatePuzzle(GOOD, BLOCKLIST)).toEqual([]);
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
});
