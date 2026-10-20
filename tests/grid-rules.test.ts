import { describe, expect, it } from 'vitest';
import { GridGame } from '../src/grid/rules';
import type { GridPuzzle } from '../src/grid/types';
import { wordChecker } from '../src/grid/words';

/**
 *   G N A T     a a b b        sections: a = G N N O, b = A T, c = A K S, d = A N T, e = E W
 *   N O . A     a a . c        runs: GNAT NO ANTS WE (across), GNAW NONE TASK (down)
 *   A N T S     d d d c
 *   W E . K     e e . c
 */
const PUZZLE: GridPuzzle = { size: 4, cells: 'gnatno.aantswe.k', sections: 'aabbaa.cdddcee.c' };
const isWord = wordChecker({ words: ['gnat', 'no', 'ants', 'we', 'gnaw', 'none', 'task'] });
const fresh = () => new GridGame(PUZZLE, [], [], isWord);
const letters = (game: GridGame) => game.placed.map((l) => l || '.').join('');
const trayText = (game: GridGame, section: number) =>
  game.tray(section).map(({ letter, used }) => (used ? letter.toUpperCase() : letter)).join('');

function solveAllBut(game: GridGame, skip: number[] = []): void {
  game.shape.squares.forEach((square) => {
    if (!skip.includes(square)) game.place(square, game.shape.answer[square]);
  });
}

describe('placing letters', () => {
  it('starts empty, with the first square selected and every tray letter free', () => {
    const game = fresh();
    expect(letters(game)).toBe('................');
    expect(game.firstEmpty()).toBe(0);
    expect(trayText(game, 0)).toBe('gnno');
  });

  it("puts a section's letter in one of its squares and marks it used in the tray", () => {
    const game = fresh();
    expect(game.place(0, 'g')).toBe(true);
    expect(game.letterAt(0)).toBe('g');
    expect(trayText(game, 0)).toBe('Gnno');
  });

  it("never puts a letter in another section's square, or in a blocked square", () => {
    const game = fresh();
    expect(game.place(0, 'a')).toBe(false);
    expect(game.place(6, 'g')).toBe(false);
    expect(letters(game)).toBe('................');
  });

  it('uses a repeated letter only as many times as the section has it', () => {
    const game = fresh();
    expect(game.place(1, 'n')).toBe(true);
    expect(game.place(4, 'n')).toBe(true);
    expect(game.place(5, 'n')).toBe(false);
    expect(trayText(game, 0)).toBe('gNNo');
  });

  it('sends the letter already in a square back to the tray', () => {
    const game = fresh();
    game.place(0, 'g');
    expect(game.place(0, 'o')).toBe(true);
    expect(game.letterAt(0)).toBe('o');
    expect(trayText(game, 0)).toBe('gnnO');
  });

  it('swaps two squares of a section, but never across sections', () => {
    const game = fresh();
    game.place(0, 'g');
    game.place(1, 'o');
    expect(game.move(0, 1)).toBe(true);
    expect(letters(game).slice(0, 2)).toBe('og');
    expect(game.move(0, 5)).toBe(true);
    expect(game.letterAt(5)).toBe('o');
    expect(game.letterAt(0)).toBe('');
    expect(game.move(1, 2)).toBe(false);
  });

  it('takes a letter back off the grid', () => {
    const game = fresh();
    game.place(0, 'g');
    expect(game.remove(0)).toBe(true);
    expect(game.letterAt(0)).toBe('');
    expect(game.remove(0)).toBe(false);
  });

  it('moves the selection to the next empty square of the section, wrapping, or nowhere when it is full', () => {
    const game = fresh();
    game.place(1, 'n');
    expect(game.nextEmptyInSection(1)).toBe(4);
    game.place(4, 'n');
    game.place(5, 'o');
    expect(game.nextEmptyInSection(5)).toBe(0);
    game.place(0, 'g');
    expect(game.nextEmptyInSection(0)).toBeNull();
  });
});

describe('checking words', () => {
  it('marks a full run that is not a word, and only full runs', () => {
    const game = fresh();
    game.place(4, 'o');
    expect(game.badRuns()).toEqual([]);
    game.place(5, 'n');
    expect(game.badRuns()).toEqual([1]);
    game.move(4, 5);
    expect(game.badRuns()).toEqual([]);
  });

  it('is solved when every square is filled and every run is a word', () => {
    const game = fresh();
    solveAllBut(game, [15]);
    expect(game.solved).toBe(false);
    game.place(15, 'k');
    expect(game.badRuns()).toEqual([]);
    expect(game.solved).toBe(true);
  });
});

describe('Hint', () => {
  it('puts the right letter in the selected square and locks it', () => {
    const game = fresh();
    expect(game.hint(5)).toBe(5);
    expect(game.letterAt(5)).toBe('o');
    expect(game.hinted).toEqual([5]);
    expect(game.isHinted(5)).toBe(true);
    expect(game.remove(5)).toBe(false);
    expect(game.place(5, 'g')).toBe(false);
    expect(game.move(5, 0)).toBe(false);
    expect(game.move(0, 5)).toBe(false);
    expect(trayText(game, 0)).toBe('gnnO');
  });

  it('fills the first wrong or empty square when the selected one is already right', () => {
    const game = fresh();
    game.place(0, 'g');
    expect(game.hint(0)).toBe(1);
    expect(game.letterAt(1)).toBe('n');
  });

  it("takes the right letter from a square where it's wrong when the tray has none left", () => {
    const game = fresh();
    game.place(2, 't');
    game.place(3, 'a');
    expect(game.hint(2)).toBe(2);
    expect(game.letterAt(2)).toBe('a');
    expect(game.letterAt(3)).toBe('');
    expect(trayText(game, 1)).toBe('At');
  });

  it('can finish the puzzle, and does nothing once everything is right', () => {
    const game = fresh();
    solveAllBut(game, [15]);
    expect(game.hint(0)).toBe(15);
    expect(game.solved).toBe(true);
    expect(game.hint(0)).toBeNull();
  });
});

describe('restoring saved letters', () => {
  it("keeps hinted squares and the letters that fit, dropping letters that don't belong", () => {
    const placed = ['n', 'g', '', '', 'n', '', 'x', '', '', '', '', '', '', '', '', ''];
    const game = new GridGame(PUZZLE, placed, [1, 6, 99], isWord);
    expect(game.hinted).toEqual([1]);
    expect(game.letterAt(1)).toBe('n');
    expect(game.letterAt(0)).toBe('n');
    expect(game.letterAt(4)).toBe('');
    expect(game.letterAt(6)).toBe('');
  });
});
