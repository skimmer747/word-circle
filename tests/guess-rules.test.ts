import { describe, expect, it } from 'vitest';
import { GuessGame, firstVisibleGuess, markGuess } from '../src/guess/rules';

const ACCEPTED = new Set(['stare', 'crane', 'pious', 'eerie', 'slate', 'slave', 'tales', 'house']);
const game = (answer = 'slate', guesses: string[] = [], hinted: number[] = []) =>
  new GuessGame(answer, guesses, hinted, (word) => ACCEPTED.has(word));
const letters = (g: GuessGame) => g.row.map((square) => square.letter || '_').join('');
const typeWord = (g: GuessGame, word: string) => [...word].forEach((letter) => g.type(letter));

describe('coloring a guess', () => {
  it('marks right, wrong-spot and missing letters', () => {
    expect(markGuess('stare', 'slate')).toEqual(['right', 'present', 'right', 'absent', 'right']);
  });

  it('marks every letter right for the answer', () => {
    expect(markGuess('slate', 'slate')).toEqual(['right', 'right', 'right', 'right', 'right']);
  });

  it('colors only as many copies of a letter as the answer has', () => {
    expect(markGuess('eerie', 'crane')).toEqual(['absent', 'absent', 'present', 'absent', 'right']);
    expect(markGuess('speed', 'abide')).toEqual(['absent', 'absent', 'present', 'absent', 'present']);
  });

  it('marks right spots before wrong spots', () => {
    expect(markGuess('lolly', 'hello')).toEqual(['absent', 'present', 'right', 'right', 'absent']);
  });
});

describe('typing', () => {
  it('fills the row left to right and stops when it is full', () => {
    const g = game();
    typeWord(g, 'sta');
    expect(letters(g)).toBe('sta__');
    expect(g.nextSquare()).toBe(3);
    typeWord(g, 're');
    expect(g.type('x')).toBe(false);
    expect(letters(g)).toBe('stare');
    expect(g.nextSquare()).toBe(-1);
  });

  it('Back removes the last letter she typed', () => {
    const g = game();
    typeWord(g, 'st');
    expect(g.back()).toBe(true);
    expect(letters(g)).toBe('s____');
    expect(g.back()).toBe(true);
    expect(g.back()).toBe(false);
  });
});

describe('checking a row', () => {
  it('says the row is incomplete when it is not full, and keeps her letters', () => {
    const g = game();
    typeWord(g, 'sta');
    expect(g.enter()).toBe('incomplete');
    expect(letters(g)).toBe('sta__');
  });

  it('keeps her letters when the word is not on the list', () => {
    const g = game();
    typeWord(g, 'staxe');
    expect(g.enter()).toBe('notAWord');
    expect(letters(g)).toBe('staxe');
    expect(g.guesses).toEqual([]);
  });

  it('makes an accepted word a guess and starts the next row with right-spot letters locked', () => {
    const g = game();
    typeWord(g, 'stare');
    expect(g.enter()).toBe('guessed');
    expect(g.guesses).toEqual(['stare']);
    expect(letters(g)).toBe('s_a_e');
    expect(g.row.map((square) => square.locked)).toEqual([true, false, true, false, true]);
  });

  it('types and erases around locked letters', () => {
    const g = game('slate', ['stare']);
    typeWord(g, 'lt');
    expect(letters(g)).toBe('slate');
    g.back();
    expect(letters(g)).toBe('sla_e');
    g.back();
    expect(letters(g)).toBe('s_a_e');
    expect(g.back()).toBe(false);
  });

  it('is solved when she types the answer', () => {
    const g = game('slate', ['stare']);
    typeWord(g, 'lt');
    expect(g.enter()).toBe('solved');
    expect(g.solved).toBe(true);
    expect(g.solvedByGuess).toBe(true);
  });

  it('accepts the answer even if it is not on the list', () => {
    const g = game('zesty');
    typeWord(g, 'zesty');
    expect(g.enter()).toBe('solved');
  });
});

describe('what she knows', () => {
  it('knows right-spot letters from every guess, and hinted squares', () => {
    expect(game('slate', ['stare', 'tales'], [1]).known()).toEqual([0, 1, 2, 4]);
  });

  it('gives each key the best color it has earned', () => {
    const keys = game('slate', ['pious', 'stare']).keyStates();
    expect(keys.get('s')).toBe('right');
    expect(keys.get('t')).toBe('present');
    expect(keys.get('r')).toBe('absent');
    expect(keys.get('p')).toBe('absent');
    expect(keys.get('l')).toBeUndefined();
  });

  it('counts hinted letters as right', () => {
    expect(game('slate', [], [1]).keyStates().get('l')).toBe('right');
  });

  it('never marks a letter in the word as missing', () => {
    expect(game('crane', ['eerie']).keyStates().get('e')).toBe('right');
  });

  it('is untouched until she types, guesses or takes a hint', () => {
    expect(game().untouched).toBe(true);
    const typed = game();
    typed.type('s');
    expect(typed.untouched).toBe(false);
    expect(game('slate', ['stare']).untouched).toBe(false);
    expect(game('slate', [], [0]).untouched).toBe(false);
  });
});

describe('hints', () => {
  it('fills the leftmost square she does not know yet, and locks it', () => {
    const g = game('slate', ['stare']);
    expect(g.hint()).toEqual({ position: 1, solved: false });
    expect(letters(g)).toBe('sla_e');
    expect(g.row[1].locked).toBe(true);
    expect(g.hinted).toEqual([1]);
  });

  it('replaces a letter she typed in that square and keeps her others', () => {
    const g = game('slate', ['stare']);
    typeWord(g, 'xy');
    expect(letters(g)).toBe('sxaye');
    g.hint();
    expect(letters(g)).toBe('slaye');
  });

  it('carries hinted letters down to the next row', () => {
    const g = game('slate', ['stare']);
    g.hint();
    typeWord(g, 'v');
    expect(g.enter()).toBe('guessed');
    expect(letters(g)).toBe('sla_e');
  });

  it('solves the word when the last unknown letter is hinted', () => {
    const g = game('slate', ['stare'], [1]);
    expect(g.hint()).toEqual({ position: 3, solved: true });
    expect(g.solved).toBe(true);
    expect(g.solvedByGuess).toBe(false);
  });

  it('has nothing to give once the word is solved', () => {
    expect(game('slate', ['slate']).hint()).toBeNull();
  });
});

describe("the board's six rows", () => {
  it('shows from the first guess until she has more than five', () => {
    expect([0, 1, 5].map(firstVisibleGuess)).toEqual([0, 0, 0]);
    expect([6, 9].map(firstVisibleGuess)).toEqual([1, 4]);
  });
});
