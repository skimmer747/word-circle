/** Days are local calendar dates as "YYYY-MM-DD". */
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

const MILESTONES = [10, 25, 50, 100, 250, 500, 750, 1000];
/** After 1,000, every 500th is a milestone too. */
const LATE_MILESTONE_EVERY = 500;

export function isMilestone(n: number): boolean {
  return MILESTONES.includes(n) || (n > 1000 && n % LATE_MILESTONE_EVERY === 0);
}

/** Days in a row on which she finished something, in either game. */
export interface PlayDays {
  streakDays: number;
  lastPlayedDay: string | null;
}

/** Marks `day` as played. A missed day quietly starts the count over; nothing ever says a streak was lost. */
export function recordPlayDay(days: PlayDays, day: string): PlayDays {
  if (days.lastPlayedDay === day) return { streakDays: Math.max(1, days.streakDays), lastPlayedDay: day };
  const streakDays = days.lastPlayedDay === previousDay(day) ? days.streakDays + 1 : 1;
  return { streakDays, lastPlayedDay: day };
}

/** `day` moved by `n` days (negative for earlier), as "YYYY-MM-DD". */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
