import type { DailyWord } from '../src/guess/daily';

const FIVE = /^[a-z]{5}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Reads one reply from the NYT's daily Wordle address. Null if it isn't usable or the word must never be used. */
export function parseNytReply(reply: unknown, date: string, neverUse: ReadonlySet<string>): DailyWord | null {
  if (typeof reply !== 'object' || reply === null) return null;
  const { solution, print_date: printDate, days_since_launch: number } = reply as Record<string, unknown>;
  if (typeof solution !== 'string' || printDate !== date || !Number.isInteger(number) || (number as number) < 0) return null;
  const word = solution.trim().toLowerCase();
  if (!FIVE.test(word) || neverUse.has(word)) return null;
  return { date, number: number as number, word };
}

/** Yesterday through two days ahead (UTC), so every time zone has its word and one missed run doesn't matter. */
export function datesAround(now: Date): string[] {
  return [-1, 0, 1, 2].map((offset) => new Date(now.getTime() + offset * DAY_MS).toISOString().slice(0, 10));
}

/** daily-word.txt: one "2026-10-20 1949 crane" per line. */
export function formatDailyFile(words: readonly DailyWord[]): string {
  return words.map(({ date, number, word }) => `${date} ${number} ${word}\n`).join('');
}
