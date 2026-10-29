import { NOTHING_AVOIDED, type AvoidCheck } from '../shared/avoid';
import type { KeyValueStore } from '../shared/store';
import { listWord, type SavedGuess } from './storage';
import type { GuessWords } from './words';

/** One day's Wordle word, from daily-word.txt. */
export interface DailyWord {
  date: string;
  /** The NYT's puzzle number. */
  number: number;
  word: string;
}

/** The last daily-word.txt the iPad saw, so the daily word still works offline. */
export const DAILY_CACHE_KEY = 'word-guess:daily';

const LINE = /^(\d{4}-\d{2}-\d{2})\s+(\d+)\s+([a-z]{5})$/;

/** Reads daily-word.txt: one "2026-10-20 1949 crane" per line. Lines that can't be read are skipped. */
export function parseDailyWords(text: string): DailyWord[] {
  const words: DailyWord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = LINE.exec(line.trim().toLowerCase());
    if (match) words.push({ date: match[1], number: Number(match[2]), word: match[3] });
  }
  return words;
}

export function dailyFor(words: readonly DailyWord[], day: string): DailyWord | null {
  return words.find((word) => word.date === day) ?? null;
}

/**
 * True while her word is the real Wordle on its own day, when there are no hints. After midnight it finishes like
 * any other word, hints and all.
 */
export function isTodaysWordle(saved: SavedGuess, day: string): boolean {
  return saved.daily?.date === day;
}

export function cachedDailyWords(store: KeyValueStore): DailyWord[] {
  try {
    return parseDailyWords(store.getItem(DAILY_CACHE_KEY) ?? '');
  } catch {
    return [];
  }
}

/** Fetches daily-word.txt; returns its words, or null if it couldn't be fetched (the cached copy still stands). */
export async function refreshDailyWords(fetchText: () => Promise<string>, store: KeyValueStore): Promise<DailyWord[] | null> {
  let text: string;
  try {
    text = await fetchText();
  } catch {
    return null;
  }
  try {
    store.setItem(DAILY_CACHE_KEY, text);
  } catch {
    // Storage unavailable: use this copy for now anyway.
  }
  return parseDailyWords(text);
}

/**
 * Puts today's daily word in place of a word she hasn't touched (her place in the list stays where it is).
 * Null if nothing changes: no word today, she has started her word, or she has already played today's.
 */
export function swapInDaily(saved: SavedGuess, today: DailyWord | null, untouched: boolean): SavedGuess | null {
  if (!today || !untouched || saved.daily?.date === today.date || saved.dailyDone?.date === today.date) return null;
  return { ...saved, word: today.word, daily: { date: today.date, number: today.number }, guesses: [], hinted: [], elapsedMs: undefined };
}

/** Whether Share is offered: she finished `day`'s Wordle and hasn't sent it yet. */
export function canShareToday(saved: SavedGuess, day: string): boolean {
  const done = saved.dailyDone;
  return done !== null && done.date === day && done.share !== '' && !done.shared;
}

/** After she sends `day`'s Wordle: Share isn't offered again until the next day's. */
export function markShared(saved: SavedGuess, day: string): SavedGuess {
  if (saved.dailyDone?.date !== day) return saved;
  return { ...saved, dailyDone: { ...saved.dailyDone, shared: true } };
}

/**
 * After she finishes her word on `day`: remembers a finished daily word (with its share text) and picks what
 * comes next, which is today's daily word if she hasn't played it, otherwise the next list word.
 */
export function finishWord(
  saved: SavedGuess,
  words: GuessWords,
  day: string,
  share: string,
  today: DailyWord | null,
  avoided: AvoidCheck = NOTHING_AVOIDED,
): SavedGuess {
  const finishedToday = saved.daily?.date === day;
  const index = saved.daily === null ? saved.index + 1 : saved.index;
  const dailyDone = finishedToday ? { date: day, share } : saved.dailyDone;
  const next = listWord({ ...saved, dailyDone }, words, index, avoided);
  return swapInDaily(next, today, true) ?? next;
}
