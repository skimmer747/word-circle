import { describe, expect, it } from 'vitest';
import { shareText } from '../src/guess/share';

describe('the text she shares', () => {
  it("looks like Wordle's own", () => {
    expect(shareText(1948, 'slate', ['pious', 'stare', 'slate'], false)).toBe(
      'Wordle 1,948 3/6\n\n⬜⬜⬜⬜🟨\n🟩🟨🟩⬜🟩\n🟩🟩🟩🟩🟩',
    );
  });

  it('says how many tries when she needed more than six, never X/6', () => {
    const guesses = ['pious', 'crane', 'house', 'pious', 'crane', 'house', 'stare', 'slate'];
    const text = shareText(1948, 'slate', guesses, false);
    expect(text.split('\n')[0]).toBe('Wordle 1,948 in 8 tries');
    expect(text.split('\n')).toHaveLength(10);
  });

  it('ends with a green row, counted as a try, when a hint finished the word', () => {
    expect(shareText(1948, 'slate', ['stare'], true)).toBe('Wordle 1,948 2/6\n\n🟩🟨🟩⬜🟩\n🟩🟩🟩🟩🟩');
  });

  it('writes the number the way Wordle does', () => {
    expect(shareText(987, 'slate', ['slate'], false).split('\n')[0]).toBe('Wordle 987 1/6');
    expect(shareText(12345, 'slate', ['slate'], false).split('\n')[0]).toBe('Wordle 12,345 1/6');
  });
});
