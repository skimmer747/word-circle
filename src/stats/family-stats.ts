import { formatDuration } from '../circle/stats';
import { GAME_IDS, GAME_TITLES, type GameId } from '../frame/games';
import { addDays } from '../shared/days';
import { mostPlayedLevel, type PlayLevel, type PlayRecord } from './log';

/** The charts cover this many weeks... */
export const WEEKS = 12;
/** ...and wait for this many days of play log. */
export const READY_DAYS = 14;
/** The table and the per-day charts cover 4 weeks. */
const PERIOD_DAYS = 28;

const LEVEL_NAMES: Record<PlayLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
/** Short names, for labels at the ends of chart lines. */
const SHORT: Record<GameId, string> = { circle: 'Circle', guess: 'Guess', grid: 'Grid' };
const PARTS = [
  ['Morning', 5, 11],
  ['Afternoon', 12, 16],
  ['Evening', 17, 20],
] as const;

/** One line on a weekly chart: a value per week, oldest first, null for a week without play. */
export interface Series {
  game: GameId;
  label: string;
  points: (number | null)[];
}

export interface TableRow {
  label: string;
  last: string;
  before: string;
}

/** Everything the How she's doing section draws. */
export interface FamilyStats {
  since: string | null;
  ready: boolean;
  table: TableRow[];
  /** Minutes per puzzle at each game's most-played level. */
  speed: Series[];
  hints: Series[];
  tries: Series | null;
  /** The last 28 days, oldest first, and their puzzle counts. */
  days: string[];
  perDay: number[];
  timeOfDay: { label: string; share: number }[];
  games: { game: GameId; label: string; counts: number[] }[];
  /** The first day of each weekly bucket, oldest first. */
  weekStarts: string[];
}

const average = (values: readonly number[]): number | null => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);
const between = (r: PlayRecord, from: string, to: string): boolean => r.day >= from && r.day <= to;

/** A round number at or above `max` for the top of an axis: 1, 2 or 5 times a power of ten. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 5, 10].map((m) => m * power).find((n) => n >= max) ?? 10 * power;
}

/** "Oct 5". */
export function shortDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function table(
  log: readonly PlayRecord[],
  today: string,
  since: string | null,
  present: readonly GameId[],
  levels: ReadonlyMap<GameId, PlayLevel | null>,
): TableRow[] {
  const beforeFrom = addDays(today, -(2 * PERIOD_DAYS - 1));
  const last = log.filter((r) => between(r, addDays(today, -(PERIOD_DAYS - 1)), today));
  const before = log.filter((r) => between(r, beforeFrom, addDays(today, -PERIOD_DAYS)));
  const rows: TableRow[] = [];
  const row = (label: string, pick: (records: readonly PlayRecord[]) => number[], format: (v: number) => string) => {
    const a = average(pick(last));
    const b = average(pick(before));
    if (a !== null && b !== null) rows.push({ label, last: format(a), before: format(b) });
  };
  for (const game of present) {
    const level = levels.get(game) ?? null;
    const label = game === 'guess' || level === null ? `${GAME_TITLES[game]}: time per word` : `${GAME_TITLES[game]}, ${LEVEL_NAMES[level]}: time per puzzle`;
    row(label, (rs) => rs.filter((r) => r.game === game && r.level === level).map((r) => r.ms), formatDuration);
  }
  for (const game of present.filter((g) => g !== 'guess')) {
    row(`${GAME_TITLES[game]}: hints per puzzle`, (rs) => rs.filter((r) => r.game === game).map((r) => r.hints), (v) => v.toFixed(1));
  }
  if (present.includes('guess')) {
    row('Word Guess: tries per word', (rs) => rs.filter((r) => r.game === 'guess' && r.tries > 0).map((r) => r.tries), (v) => v.toFixed(1));
  }
  if (since !== null && since <= beforeFrom) {
    const played = (rs: readonly PlayRecord[]) => new Set(rs.map((r) => r.day)).size;
    rows.push({ label: 'Days played', last: `${played(last)} of ${PERIOD_DAYS}`, before: `${played(before)} of ${PERIOD_DAYS}` });
  }
  return rows;
}

/** The family's weekly figures from the play log. `since` is the first logged day (from the lifetime figures). */
export function familyStats(log: readonly PlayRecord[], today: string, since: string | null): FamilyStats {
  const weekStarts = Array.from({ length: WEEKS }, (_, i) => addDays(today, -(7 * (WEEKS - 1 - i) + 6)));
  const weekly = (records: readonly PlayRecord[], value: (r: PlayRecord) => number): (number | null)[] =>
    weekStarts.map((start) => average(records.filter((r) => between(r, start, addDays(start, 6))).map(value)));
  const recent = log.filter((r) => between(r, weekStarts[0], today));
  const present = GAME_IDS.filter((g) => recent.some((r) => r.game === g));
  const levels = new Map(present.map((g) => [g, g === 'guess' ? null : mostPlayedLevel(recent.filter((r) => r.game === g))] as const));

  const speed = present.map((g) => ({
    game: g,
    label: SHORT[g],
    points: weekly(recent.filter((r) => r.game === g && r.level === levels.get(g)), (r) => r.ms / 60_000),
  }));
  const hints = present.filter((g) => g !== 'guess').map((g) => ({ game: g, label: SHORT[g], points: weekly(recent.filter((r) => r.game === g), (r) => r.hints) }));
  const guessed = recent.filter((r) => r.game === 'guess' && r.tries > 0);
  const tries = guessed.length > 0 ? { game: 'guess' as const, label: SHORT.guess, points: weekly(guessed, (r) => r.tries) } : null;

  const days = Array.from({ length: PERIOD_DAYS }, (_, i) => addDays(today, i - (PERIOD_DAYS - 1)));
  const perDay = days.map((day) => log.filter((r) => r.day === day).length);
  const period = log.filter((r) => between(r, days[0], today));
  const parts = PARTS.map(([, from, to]) => period.filter((r) => r.hour >= from && r.hour <= to).length);
  const shares = [...parts, period.length - parts.reduce((a, b) => a + b, 0)];
  const timeOfDay = ['Morning', 'Afternoon', 'Evening', 'Night'].map((label, i) => ({
    label,
    share: period.length === 0 ? 0 : Math.round((100 * shares[i]) / period.length),
  }));
  const games = present.map((g) => ({
    game: g,
    label: GAME_TITLES[g],
    counts: weekStarts.map((start) => recent.filter((r) => r.game === g && between(r, start, addDays(start, 6))).length),
  }));

  return {
    since,
    ready: since !== null && since <= addDays(today, -(READY_DAYS - 1)),
    table: table(log, today, since, present, levels),
    speed,
    hints,
    tries,
    days,
    perDay,
    timeOfDay,
    games,
    weekStarts,
  };
}
