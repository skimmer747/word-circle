import type { Level } from './types';

/** Her lifetime stats. Days are local calendar dates as "YYYY-MM-DD". */
export interface Stats {
  totalSolved: number;
  bestMs: Partial<Record<Level, number>>;
  streakDays: number;
  lastPlayedDay: string | null;
  todaySolved: number;
}

/** What the celebration card shows after a puzzle. Everything here is good news. */
export interface Celebration {
  /** Her new best time for this level, or null if she didn't beat it. */
  recordMs: number | null;
  streakDays: number;
  todaySolved: number;
  puzzleNumber: number;
  milestone: boolean;
}

const MILESTONES = [10, 25, 50, 100, 250, 500, 750, 1000];
/** After 1,000, every 500th puzzle is a milestone too. */
const LATE_MILESTONE_EVERY = 500;

export function emptyStats(): Stats {
  return { totalSolved: 0, bestMs: {}, streakDays: 0, lastPlayedDay: null, todaySolved: 0 };
}

export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The calendar day before `day` ("YYYY-MM-DD"), worked out in UTC so clock changes don't matter. */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const before = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000);
  return before.toISOString().slice(0, 10);
}

function isMilestone(n: number): boolean {
  return MILESTONES.includes(n) || (n > 1000 && n % LATE_MILESTONE_EVERY === 0);
}

export function recordSolve(
  stats: Stats,
  level: Level,
  elapsedMs: number,
  day: string,
): { stats: Stats; celebration: Celebration } {
  const sameDay = stats.lastPlayedDay === day;
  const streakDays = sameDay ? stats.streakDays : stats.lastPlayedDay === previousDay(day) ? stats.streakDays + 1 : 1;
  const todaySolved = sameDay ? stats.todaySolved + 1 : 1;
  const totalSolved = stats.totalSolved + 1;
  const best = stats.bestMs[level];
  const isRecord = best === undefined || elapsedMs < best;
  return {
    stats: {
      totalSolved,
      bestMs: isRecord ? { ...stats.bestMs, [level]: elapsedMs } : stats.bestMs,
      streakDays,
      lastPlayedDay: day,
      todaySolved,
    },
    celebration: {
      recordMs: isRecord ? elapsedMs : null,
      streakDays,
      todaySolved,
      puzzleNumber: totalSolved,
      milestone: isMilestone(totalSolved),
    },
  };
}

/** "45 sec", "1 min", "1 min 52 sec", "1 hr 3 min". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  if (minutes > 0) return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} min`;
  return `${seconds} sec`;
}
