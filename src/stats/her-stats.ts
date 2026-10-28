import { formatDuration } from '../circle/stats';
import type { GameId, GameSummary } from '../frame/games';
import { LEVEL_COUNTS } from '../jigsaw/types';
import { addDays, isMilestone } from '../shared/days';
import type { KeyValueStore } from '../shared/store';
import { PLAY_LEVELS, mostPlayedLevel, type Lifetime, type PlayLevel, type PlayRecord } from './log';

export const SEEN_KEY = 'word-games:stats-seen:v1';
/** Her stats are five cards, stepped through with Next. */
export const CARD_COUNT = 5;

const LEVEL_NAMES: Record<PlayLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const TRIES_LABELS = ['1', '2', '3', '4', '5', '6', '7+'];
const GARDEN_DAYS = 28;
/** Parts of the day for "you're a morning player": start and end hours. There's no "night player". */
const PARTS = [
  ['morning', 5, 11],
  ['afternoon', 12, 16],
  ['evening', 17, 20],
] as const;

/** A game turned on in settings, with its saved figures. */
export interface StatsGame extends GameSummary {
  id: GameId;
  title: string;
}

/** What she saw last time, so something new can be celebrated once. */
export interface Seen {
  total: number;
  circleBest: Partial<Record<PlayLevel, number>>;
  fewestTries: number | null;
  longestWord: string;
}

export interface HerStatsInput {
  games: readonly StatsGame[];
  streak: { streakDays: number; lastPlayedDay: string | null };
  log: readonly PlayRecord[];
  lifetime: Lifetime;
  today: string;
  seen: Seen | null;
}

export type StatIcon = 'sun' | 'calendar' | 'trophy' | 'target' | 'rocket';

export interface StatLine {
  icon: StatIcon;
  text: string;
  isNew: boolean;
}

/** The five cards' content. Every word of it is good news. */
export interface HerStats {
  total: { value: number; label: string; lines: StatLine[]; isNew: boolean };
  podium: { entries: { id: GameId; title: string; solved: number; top: boolean }[]; note: string | null };
  bests: {
    fastest: StatLine[];
    others: StatLine[];
    tries: { label: string; count: number; top: boolean }[] | null;
    triesNote: string | null;
    fewestTriesIsNew: boolean;
    isNew: boolean;
  };
  garden: { flowers: number[]; caption: string };
  facts: { word: string | null; wordIsNew: boolean; fact: string | null; empty: string | null };
}

const count = (n: number): string => n.toLocaleString('en-US');
const plural = (n: number, one: string, many: string): string => `${count(n)} ${n === 1 ? one : many}`;
const average = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0) / values.length;

function totalLabel(games: readonly StatsGame[], total: number): string {
  const words = games.some((g) => g.id === 'guess');
  const puzzles = games.some((g) => g.id !== 'guess');
  if (words && puzzles) return total === 1 ? 'puzzle or word' : 'puzzles and words';
  if (words) return total === 1 ? 'word' : 'words';
  return total === 1 ? 'puzzle' : 'puzzles';
}

/** True if a milestone (10, 25, 50 … 1,000, then every 500) lies after `from`, up to and including `to`. */
function passedMilestone(from: number, to: number): boolean {
  for (let n = from + 1; n <= to; n++) if (isMilestone(n)) return true;
  return false;
}

function totalCard({ games, streak, lifetime, today, seen }: HerStatsInput): HerStats['total'] {
  const value = games.reduce((n, g) => n + g.solved, 0);
  const lines: StatLine[] = [];
  const current = streak.lastPlayedDay === today || streak.lastPlayedDay === addDays(today, -1) ? streak.streakDays : 0;
  if (current >= 2) lines.push({ icon: 'sun', text: `${count(current)} days in a row`, isNew: false });
  if (lifetime.daysPlayed >= 1) lines.push({ icon: 'calendar', text: plural(lifetime.daysPlayed, 'day played', 'days played'), isNew: false });
  return { value, label: totalLabel(games, value), lines, isNew: seen !== null && passedMilestone(seen.total, value) };
}

function podiumCard({ games, log }: HerStatsInput): HerStats['podium'] {
  const ranked = [...games].sort((a, b) => b.solved - a.solved);
  // The favorite in the middle (second from the left with four).
  const order =
    ranked.length >= 3 ? [ranked[1], ranked[0], ...ranked.slice(2)] : ranked.length === 2 ? [ranked[1], ranked[0]] : ranked;
  const top = ranked[0];
  const entries = order.map((g) => ({ id: g.id, title: g.title, solved: g.solved, top: g === top && g.solved > 0 }));
  const level = top && top.id !== 'guess' ? mostPlayedLevel(log.filter((r) => r.game === top.id)) : null;
  const note = level === null ? null : top.id === 'jigsaw' ? `Mostly ${LEVEL_COUNTS[level]} pieces` : `Mostly on ${LEVEL_NAMES[level]}`;
  return { entries, note };
}

/** Word Circle's most-played level, if her last 7 days there beat the 7 before (at least 3 puzzles in each). */
function quickerLevel(log: readonly PlayRecord[], today: string): PlayLevel | null {
  const recent = log.filter((r) => r.game === 'circle' && r.day >= addDays(today, -13) && r.day <= today);
  const level = mostPlayedLevel(recent);
  if (!level) return null;
  const atLevel = recent.filter((r) => r.level === level);
  const last = atLevel.filter((r) => r.day >= addDays(today, -6)).map((r) => r.ms);
  const before = atLevel.filter((r) => r.day < addDays(today, -6)).map((r) => r.ms);
  return last.length >= 3 && before.length >= 3 && average(last) < average(before) ? level : null;
}

function bestsCard({ games, lifetime, log, today, seen }: HerStatsInput): HerStats['bests'] {
  const has = (id: GameId) => games.some((g) => g.id === id);
  const circle = games.find((g) => g.id === 'circle');
  const fastest: StatLine[] = [];
  for (const level of PLAY_LEVELS) {
    const ms = circle?.bestMs?.[level];
    if (ms === undefined) continue;
    const before = seen?.circleBest[level];
    fastest.push({ icon: 'trophy', text: `${LEVEL_NAMES[level]} ${formatDuration(ms)}`, isNew: seen !== null && (before === undefined || ms < before) });
  }
  const others: StatLine[] = [];
  const quicker = circle ? quickerLevel(log, today) : null;
  if (quicker) others.push({ icon: 'rocket', text: `Getting quicker at ${LEVEL_NAMES[quicker]}!`, isNew: false });
  if (has('grid') && lifetime.noHintGrids >= 1) {
    others.push({ icon: 'target', text: `${plural(lifetime.noHintGrids, 'Word Grid', 'Word Grids')}, no hints`, isNew: false });
  }
  let tries: HerStats['bests']['tries'] = null;
  let triesNote: string | null = null;
  if (has('guess')) {
    const most = Math.max(...lifetime.triesCounts);
    if (most > 0) {
      const topIndex = lifetime.triesCounts.indexOf(most);
      tries = lifetime.triesCounts.map((n, i) => ({ label: TRIES_LABELS[i], count: n, top: i === topIndex }));
    } else {
      triesNote = 'Your Word Guess chart starts with your next word.';
    }
  }
  const fewestTriesIsNew =
    seen !== null && lifetime.fewestTries !== null && (seen.fewestTries === null || lifetime.fewestTries < seen.fewestTries);
  return { fastest, others, tries, triesNote, fewestTriesIsNew, isNew: fewestTriesIsNew || fastest.some((l) => l.isNew) };
}

function gardenCard({ log, today }: HerStatsInput): HerStats['garden'] {
  const perDay = new Map<string, number>();
  for (const r of log) perDay.set(r.day, (perDay.get(r.day) ?? 0) + 1);
  const flowers = Array.from({ length: GARDEN_DAYS }, (_, i) => {
    const n = perDay.get(addDays(today, i - (GARDEN_DAYS - 1))) ?? 0;
    return n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : 3;
  });
  const grown = flowers.filter((f) => f > 0).length;
  return { flowers, caption: grown === 0 ? "Your garden starts growing with today's puzzles" : `${plural(grown, 'flower', 'flowers')} in your garden` };
}

function partOfDay(hours: readonly number[]): string | null {
  if (hours.reduce((a, b) => a + b, 0) < 10) return null;
  let best: string | null = null;
  let most = 0;
  for (const [name, from, to] of PARTS) {
    const n = hours.slice(from, to + 1).reduce((a, b) => a + b, 0);
    if (n > most) {
      best = name;
      most = n;
    }
  }
  return best;
}

function dayOfYear(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
}

function factsCard({ lifetime, seen, today }: HerStatsInput): HerStats['facts'] {
  const word = lifetime.longestWord.length >= 5 ? lifetime.longestWord.toUpperCase() : null;
  const wordIsNew = word !== null && seen !== null && lifetime.longestWord.length > seen.longestWord.length;
  const candidates: string[] = [];
  if (lifetime.words >= 50) candidates.push(`You've found ${count(lifetime.words)} words`);
  if (lifetime.letters >= 200) candidates.push(`You've spelled ${count(lifetime.letters)} letters`);
  const [favorite, uses] = Object.entries(lifetime.firstGuesses).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ['', 0];
  if (uses >= 3) candidates.push(`Your favorite first guess is ${favorite.toUpperCase()}`);
  const part = partOfDay(lifetime.hours);
  if (part) candidates.push(`You're ${part === 'morning' ? 'a' : 'an'} ${part} player`);
  if (lifetime.mostInADay >= 3) candidates.push(`Your most in one day: ${count(lifetime.mostInADay)}`);
  const fact = candidates.length > 0 ? candidates[dayOfYear(today) % candidates.length] : null;
  return { word, wordIsNew, fact, empty: word === null && fact === null ? 'Fun facts appear as you play.' : null };
}

export function herStats(input: HerStatsInput): HerStats {
  return { total: totalCard(input), podium: podiumCard(input), bests: bestsCard(input), garden: gardenCard(input), facts: factsCard(input) };
}

function snapshot({ games, lifetime }: HerStatsInput): Seen {
  return {
    total: games.reduce((n, g) => n + g.solved, 0),
    circleBest: { ...(games.find((g) => g.id === 'circle')?.bestMs ?? {}) },
    fewestTries: lifetime.fewestTries,
    longestWord: lifetime.longestWord,
  };
}

/** What she has seen after card `card` was shown: only what that card showed is updated (everything, the first time). */
export function seenAfter(seen: Seen | null, input: HerStatsInput, card: number): Seen {
  const now = snapshot(input);
  if (seen === null) return now;
  if (card === 0) return { ...seen, total: now.total };
  if (card === 2) return { ...seen, circleBest: now.circleBest, fewestTries: now.fewestTries };
  if (card === 4) return { ...seen, longestWord: now.longestWord };
  return seen;
}

export function loadSeen(store: KeyValueStore): Seen | null {
  try {
    const raw = store.getItem(SEEN_KEY);
    const v: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { total, circleBest, fewestTries, longestWord } = v as Record<string, unknown>;
    if (!Number.isInteger(total) || typeof longestWord !== 'string') return null;
    if (fewestTries !== null && !Number.isInteger(fewestTries)) return null;
    if (typeof circleBest !== 'object' || circleBest === null) return null;
    return { total: total as number, circleBest: circleBest as Seen['circleBest'], fewestTries: fewestTries as number | null, longestWord };
  } catch {
    return null;
  }
}

export function saveSeen(store: KeyValueStore, seen: Seen): void {
  try {
    store.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Storage unavailable: something new may be celebrated again next time.
  }
}
