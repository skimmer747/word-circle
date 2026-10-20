import { GAME_IDS, type GameId } from '../frame/games';
import { addDays } from '../shared/days';
import type { KeyValueStore } from '../shared/store';

export const LOG_KEY = 'word-games:log:v1';
export const LIFETIME_KEY = 'word-games:lifetime:v1';
/** Detail older than this is dropped; the lifetime figures keep what lasts. */
export const KEEP_DAYS = 400;

export const PLAY_LEVELS = ['easy', 'medium', 'hard'] as const;
export type PlayLevel = (typeof PLAY_LEVELS)[number];

/** One finished puzzle or word. */
export interface PlayRecord {
  /** Local date, "2026-10-20". */
  day: string;
  /** Local hour she finished, 0–23. */
  hour: number;
  game: GameId;
  /** Null for Word Guess, which has no levels. */
  level: PlayLevel | null;
  /** Active play time. */
  ms: number;
  /** Letters revealed by Hint. */
  hints: number;
  /** Word Guess guesses; 0 for the other games. */
  tries: number;
  /** Word Guess: she typed the answer herself. Always true for the other games. */
  typed: boolean;
  /** Word Guess: it was today's Wordle. */
  daily: boolean;
  /** Words found in it, and the letters in them. */
  words: number;
  letters: number;
  /** The longest of those words. */
  longest: string;
  /** Word Guess: her first guess ('' if none); '' for the other games. */
  first: string;
}

/** Running figures since the log began; they stay when old detail is dropped. */
export interface Lifetime {
  /** The first logged day. */
  since: string | null;
  daysPlayed: number;
  lastDay: string | null;
  words: number;
  letters: number;
  longestWord: string;
  /** Word Guess, typed solves only. */
  fewestTries: number | null;
  /** Word Guess typed solves by tries: index 0 is 1 try … 5 is 6 tries, 6 is 7 or more. */
  triesCounts: number[];
  noHintGrids: number;
  firstGuesses: Record<string, number>;
  /** Records by the hour they were finished, 0–23. */
  hours: number[];
  mostInADay: number;
  /** Records on lastDay, for mostInADay. */
  todayCount: number;
}

export function emptyLifetime(): Lifetime {
  return {
    since: null,
    daysPlayed: 0,
    lastDay: null,
    words: 0,
    letters: 0,
    longestWord: '',
    fewestTries: null,
    triesCounts: [0, 0, 0, 0, 0, 0, 0],
    noHintGrids: 0,
    firstGuesses: {},
    hours: new Array<number>(24).fill(0),
    mostInADay: 0,
    todayCount: 0,
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isCount = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 0;
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v);
const isCounts = (v: unknown, length: number): boolean => Array.isArray(v) && v.length === length && v.every(isCount);

function isPlayRecord(v: unknown): v is PlayRecord {
  return (
    isRecord(v) &&
    isDay(v.day) &&
    isCount(v.hour) &&
    (v.hour as number) < 24 &&
    GAME_IDS.includes(v.game as GameId) &&
    (v.level === null || PLAY_LEVELS.includes(v.level as PlayLevel)) &&
    typeof v.ms === 'number' &&
    Number.isFinite(v.ms) &&
    v.ms >= 0 &&
    isCount(v.hints) &&
    isCount(v.tries) &&
    typeof v.typed === 'boolean' &&
    typeof v.daily === 'boolean' &&
    isCount(v.words) &&
    isCount(v.letters) &&
    typeof v.longest === 'string' &&
    typeof v.first === 'string'
  );
}

function isLifetime(v: unknown): v is Lifetime {
  return (
    isRecord(v) &&
    (v.since === null || isDay(v.since)) &&
    isCount(v.daysPlayed) &&
    (v.lastDay === null || isDay(v.lastDay)) &&
    isCount(v.words) &&
    isCount(v.letters) &&
    typeof v.longestWord === 'string' &&
    (v.fewestTries === null || isCount(v.fewestTries)) &&
    isCounts(v.triesCounts, 7) &&
    isCount(v.noHintGrids) &&
    isRecord(v.firstGuesses) &&
    Object.values(v.firstGuesses).every(isCount) &&
    isCounts(v.hours, 24) &&
    isCount(v.mostInADay) &&
    isCount(v.todayCount)
  );
}

function read(store: KeyValueStore, key: string): unknown {
  try {
    const raw = store.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(store: KeyValueStore, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the stats just stop growing; the games are unaffected.
  }
}

/** The detailed log, oldest first. Damaged entries are skipped. */
export function loadLog(store: KeyValueStore): PlayRecord[] {
  const value = read(store, LOG_KEY);
  return Array.isArray(value) ? value.filter(isPlayRecord) : [];
}

/** The lifetime figures; damaged ones start over. */
export function loadLifetime(store: KeyValueStore): Lifetime {
  const value = read(store, LIFETIME_KEY);
  return isLifetime(value) ? value : emptyLifetime();
}

/** The lifetime figures with one more finished puzzle or word. Records arrive in day order. */
export function addToLifetime(life: Lifetime, r: PlayRecord): Lifetime {
  const newDay = life.lastDay !== r.day;
  const todayCount = newDay ? 1 : life.todayCount + 1;
  const typedGuess = r.game === 'guess' && r.typed && r.tries > 0;
  const triesCounts = [...life.triesCounts];
  if (typedGuess) triesCounts[Math.min(r.tries, 7) - 1] += 1;
  return {
    since: life.since ?? r.day,
    daysPlayed: life.daysPlayed + (newDay ? 1 : 0),
    lastDay: r.day,
    words: life.words + r.words,
    letters: life.letters + r.letters,
    longestWord: r.longest.length > life.longestWord.length ? r.longest : life.longestWord,
    fewestTries: typedGuess ? Math.min(life.fewestTries ?? r.tries, r.tries) : life.fewestTries,
    triesCounts,
    noHintGrids: life.noHintGrids + (r.game === 'grid' && r.hints === 0 ? 1 : 0),
    firstGuesses: r.first ? { ...life.firstGuesses, [r.first]: (life.firstGuesses[r.first] ?? 0) + 1 } : life.firstGuesses,
    hours: life.hours.map((n, hour) => (hour === r.hour ? n + 1 : n)),
    mostInADay: Math.max(life.mostInADay, todayCount),
    todayCount,
  };
}

/** Saves a finished puzzle or word: appends it, drops detail older than KEEP_DAYS, and updates the lifetime figures. */
export function addPlay(store: KeyValueStore, record: PlayRecord): void {
  const cutoff = addDays(record.day, -KEEP_DAYS);
  const log = loadLog(store).filter((r) => r.day > cutoff);
  log.push(record);
  write(store, LOG_KEY, log);
  write(store, LIFETIME_KEY, addToLifetime(loadLifetime(store), record));
}

/** The level with the most records (ties go to the easier level); null when none has any. */
export function mostPlayedLevel(records: readonly PlayRecord[]): PlayLevel | null {
  let best: PlayLevel | null = null;
  let most = 0;
  for (const level of PLAY_LEVELS) {
    const n = records.filter((r) => r.level === level).length;
    if (n > most) {
      best = level;
      most = n;
    }
  }
  return best;
}
