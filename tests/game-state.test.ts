import { describe, expect, it } from 'vitest';
import { Game } from '../src/circle/state';
import type { Puzzle } from '../src/circle/types';

const PUZZLE: Puzzle = {
  id: 'enost',
  letters: ['n', 's', 'e', 'o', 't'],
  words: ['net', 'not', 'one', 'note', 'notes', 'stone'],
  bonus: ['eon', 'nest', 'onset', 'son', 'ten', 'toe', 'ton', 'tone', 'tones'],
};

describe('Game.tryWord', () => {
  it('accepts an answer word once', () => {
    const game = new Game(PUZZLE);
    expect(game.tryWord('one')).toEqual({ kind: 'answer', word: 'one' });
    expect(game.isFound('one')).toBe(true);
    expect(game.tryWord('one')).toEqual({ kind: 'alreadyFound', word: 'one' });
  });

  it('ignores letter case', () => {
    expect(new Game(PUZZLE).tryWord('NOTE')).toEqual({ kind: 'answer', word: 'note' });
  });

  it('recognises bonus words without marking anything found', () => {
    const game = new Game(PUZZLE);
    expect(game.tryWord('tone')).toEqual({ kind: 'bonus', word: 'tone' });
    expect(game.foundWords()).toEqual([]);
  });

  it('rejects non-words and short attempts', () => {
    const game = new Game(PUZZLE);
    expect(game.tryWord('tse').kind).toBe('notAWord');
    expect(game.tryWord('no').kind).toBe('tooShort');
  });
});

describe('Game.hint', () => {
  it('reveals the leftmost letter of the shortest unfound word', () => {
    const game = new Game(PUZZLE);
    expect(game.hint()).toEqual({ word: 'net', index: 0, completedWord: false });
    expect(game.hint()).toEqual({ word: 'net', index: 1, completedWord: false });
    expect(game.revealedIndices('net')).toEqual([0, 1]);
  });

  it('counts a word as found once every letter is revealed', () => {
    const game = new Game(PUZZLE);
    game.hint();
    game.hint();
    expect(game.hint()).toEqual({ word: 'net', index: 2, completedWord: true });
    expect(game.isFound('net')).toBe(true);
    expect(game.hint()).toEqual({ word: 'not', index: 0, completedWord: false });
  });

  it('skips words she already found', () => {
    const game = new Game(PUZZLE);
    game.tryWord('net');
    expect(game.hint()?.word).toBe('not');
  });

  it('returns null when the puzzle is complete', () => {
    const game = new Game(PUZZLE, PUZZLE.words);
    expect(game.isComplete()).toBe(true);
    expect(game.hint()).toBeNull();
  });
});

describe('extra words', () => {
  it('remembers extra words she found and flags repeats', () => {
    const game = new Game(PUZZLE);
    expect(game.tryWord('tone')).toEqual({ kind: 'bonus', word: 'tone' });
    expect(game.tryWord('nest')).toEqual({ kind: 'bonus', word: 'nest' });
    expect(game.tryWord('TONE')).toEqual({ kind: 'bonusAgain', word: 'tone' });
    expect(game.foundBonus()).toEqual(['tone', 'nest']);
  });

  it('restores extra words, dropping anything that is not an extra word', () => {
    const game = new Game(PUZZLE, [], {}, ['son', 'one', 'zebra', 'son']);
    expect(game.foundBonus()).toEqual(['son']);
    expect(game.tryWord('son').kind).toBe('bonusAgain');
  });
});

describe('Game progress', () => {
  it('reports completion only when every word is found', () => {
    const game = new Game(PUZZLE);
    for (const word of PUZZLE.words.slice(0, -1)) game.tryWord(word);
    expect(game.isComplete()).toBe(false);
    game.tryWord('stone');
    expect(game.isComplete()).toBe(true);
  });

  it('restores found words and revealed letters, dropping anything invalid', () => {
    const game = new Game(PUZZLE, ['one', 'zebra'], { note: [2, 0], zebra: [1], net: [7] });
    expect(game.foundWords()).toEqual(['one']);
    expect(game.revealedIndices('note')).toEqual([0, 2]);
    expect(game.revealedRecord()).toEqual({ note: [0, 2] });
  });

  it('lists found words in slot order', () => {
    const game = new Game(PUZZLE);
    game.tryWord('stone');
    game.tryWord('net');
    expect(game.foundWords()).toEqual(['net', 'stone']);
  });
});
