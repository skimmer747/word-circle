import { describe, expect, it } from 'vitest';
import { guessLines } from '../src/guess/celebration';

const BASE = { tries: 4, typed: true, daily: false, streakDays: 1, todaySolved: 1, wordNumber: 7 };
const texts = (result: typeof BASE) => guessLines(result).map((line) => line.text);

describe("Word Guess's good news", () => {
  it('shows tries, words today and the word number', () => {
    expect(texts(BASE)).toEqual(['Got it in 4 tries', '1 word today', 'Word number 7']);
  });

  it('says "1 try" for a single try', () => {
    expect(texts({ ...BASE, tries: 1 })[0]).toBe('Got it in 1 try');
  });

  it('leaves out tries after more than six, or when a hint finished the word', () => {
    expect(texts({ ...BASE, tries: 8 })).toEqual(['1 word today', 'Word number 7']);
    expect(texts({ ...BASE, typed: false })).toEqual(['1 word today', 'Word number 7']);
  });

  it("puts today's Wordle first, highlighted, with her tries", () => {
    const lines = guessLines({ ...BASE, daily: true });
    expect(lines[0]).toMatchObject({ kind: 'row-daily', text: "Today's Wordle in 4 tries", highlight: true });
    expect(lines).toHaveLength(3);
    expect(guessLines({ ...BASE, daily: true, tries: 9 })[0].text).toBe("That was today's Wordle");
  });

  it('shows days in a row from the second day, and never more than four lines', () => {
    const lines = guessLines({ ...BASE, daily: true, streakDays: 5, todaySolved: 3 });
    expect(lines.map((line) => line.text)).toEqual(["Today's Wordle in 4 tries", '5 days in a row', '3 words today', 'Word number 7']);
  });

  it('highlights milestones', () => {
    const lines = guessLines({ ...BASE, wordNumber: 50 });
    expect(lines[lines.length - 1]).toMatchObject({ text: 'Word number 50!', highlight: true });
  });
});
