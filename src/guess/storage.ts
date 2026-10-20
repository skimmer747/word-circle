import { NOTHING_AVOIDED, firstAllowed, type AvoidCheck } from '../shared/avoid';
import type { KeyValueStore } from '../shared/store';
import type { GuessWords } from './words';

export const GUESS_KEY = 'word-guess:v1';

/** The date and NYT puzzle number of a daily Wordle word. */
export interface DailyTag {
  date: string;
  number: number;
}

export interface GuessStats {
  totalSolved: number;
  todaySolved: number;
  lastPlayedDay: string | null;
}

/** Her place in Word Guess. */
export interface SavedGuess {
  /** Her place in the answer list: the list word she's on, or the next one while she's on a daily word. */
  index: number;
  /** The word she's on. */
  word: string;
  /** Set while the word is a daily Wordle word. */
  daily: DailyTag | null;
  /** Her checked guesses, in order. */
  guesses: string[];
  /** Squares filled by Hint. */
  hinted: number[];
  /** Active play time on this word so far (older saves don't have it). */
  elapsedMs?: number;
  /** The last daily word she finished, with its text for sharing. */
  dailyDone: { date: string; share: string } | null;
  stats: GuessStats;
}

const FIVE = /^[a-z]{5}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function emptyGuessStats(): GuessStats {
  return { totalSolved: 0, todaySolved: 0, lastPlayedDay: null };
}

export function freshGuess(words: GuessWords): SavedGuess {
  return { index: 0, word: words.answers[0], daily: null, guesses: [], hinted: [], dailyDone: null, stats: emptyGuessStats() };
}

/** Her place moved to the list word at `index` (wrapping at the end, skipping avoided words), with nothing guessed yet. */
export function listWord(saved: SavedGuess, words: GuessWords, index: number, avoided: AvoidCheck = NOTHING_AVOIDED): SavedGuess {
  const i = firstAllowed(words.answers, index % words.answers.length, avoided);
  return { ...saved, index: i, word: words.answers[i], daily: null, guesses: [], hinted: [], elapsedMs: undefined };
}

/** Counts a finished word; "today" starts over on a new day. */
export function recordGuessSolve(stats: GuessStats, day: string): GuessStats {
  return {
    totalSolved: stats.totalSolved + 1,
    todaySolved: stats.lastPlayedDay === day ? stats.todaySolved + 1 : 1,
    lastPlayedDay: day,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isCount = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 0;
const isDay = (value: unknown): boolean => typeof value === 'string' && DAY.test(value);
const isWord = (value: unknown): boolean => typeof value === 'string' && FIVE.test(value);
const isTime = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Damaged counts never cost her progress. */
function readStats(value: unknown): GuessStats {
  if (
    isRecord(value) &&
    isCount(value.totalSolved) &&
    isCount(value.todaySolved) &&
    (value.lastPlayedDay === null || isDay(value.lastPlayedDay))
  ) {
    return {
      totalSolved: value.totalSolved as number,
      todaySolved: value.todaySolved as number,
      lastPlayedDay: value.lastPlayedDay as string | null,
    };
  }
  return emptyGuessStats();
}

function readSavedGuess(value: unknown): SavedGuess | null {
  if (!isRecord(value)) return null;
  const { index, word, daily, guesses, hinted, dailyDone } = value;
  if (!isCount(index) || !isWord(word)) return null;
  if (daily !== null && !(isRecord(daily) && isDay(daily.date) && isCount(daily.number))) return null;
  if (!Array.isArray(guesses) || !guesses.every(isWord)) return null;
  if (!Array.isArray(hinted) || !hinted.every((i) => Number.isInteger(i) && i >= 0 && i < 5)) return null;
  if (dailyDone !== null && !(isRecord(dailyDone) && isDay(dailyDone.date) && typeof dailyDone.share === 'string')) return null;
  return {
    index: index as number,
    word: word as string,
    daily: daily as DailyTag | null,
    guesses: guesses as string[],
    hinted: hinted as number[],
    dailyDone: dailyDone as SavedGuess['dailyDone'],
    stats: readStats(value.stats),
    ...(isTime(value.elapsedMs) ? { elapsedMs: value.elapsedMs as number } : {}),
  };
}

export function loadSavedGuess(store: KeyValueStore, words: GuessWords, avoided: AvoidCheck = NOTHING_AVOIDED): SavedGuess {
  try {
    const raw = store.getItem(GUESS_KEY);
    const saved = raw === null ? null : readSavedGuess(JSON.parse(raw));
    if (saved) {
      // A word she should never see (just added on the settings page): move on to the next list word, fresh.
      if (avoided(saved.word)) return listWord(saved, words, saved.index, avoided);
      // A regenerated list may have a different word at her place: start that place fresh, as Word Circle does.
      if (saved.daily === null && words.answers[saved.index % words.answers.length] !== saved.word) {
        return listWord(saved, words, saved.index, avoided);
      }
      return { ...saved, index: saved.index % words.answers.length };
    }
  } catch {
    // Unreadable save: start fresh.
  }
  return listWord(freshGuess(words), words, 0, avoided);
}

export function saveSavedGuess(store: KeyValueStore, saved: SavedGuess): void {
  try {
    store.setItem(GUESS_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or unavailable: keep playing; progress just won't survive a restart.
  }
}
