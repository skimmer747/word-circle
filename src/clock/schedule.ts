/** How often an event happens. Weekdays use 0 = Sunday ... 6 = Saturday; dates are "YYYY-MM-DD". */
export type Repeat = { kind: 'daily' } | { kind: 'weekdays'; days: number[] } | { kind: 'date'; date: string };

export interface ScheduledEvent {
  name: string;
  /** Minutes after midnight. */
  minutes: number;
  repeat: Repeat;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const LINE = /^(every\s*day|daily|[a-z]+(?:\s*,\s*[a-z]+)*|\d{4}-\d{2}-\d{2})\s+(\d{1,2}(?::\d{2})?\s*(?:[ap]\.?\s*m\.?)?)\s+(.+)$/i;
const TIME = /^(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?\s*m\.?)?$/i;

/** "5:00 PM", "5 PM", "5:30pm", "8:15 a.m." or "17:45" to minutes after midnight; null if it isn't a real time. */
export function parseTime(text: string): number | null {
  const match = text.trim().match(TIME);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const half = match[3]?.toLowerCase();
  if (minute > 59) return null;
  if (half) {
    if (hour < 1 || hour > 12) return null;
    if (half === 'a' && hour === 12) hour = 0;
    if (half === 'p' && hour !== 12) hour += 12;
  } else if (hour > 23) {
    return null;
  }
  return hour * 60 + minute;
}

function parseRepeat(when: string): Repeat | null {
  if (/^(every\s*day|daily)$/i.test(when)) return { kind: 'daily' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
    const [y, m, d] = when.split('-').map(Number);
    const check = new Date(Date.UTC(y, m - 1, d));
    const real = check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
    return real ? { kind: 'date', date: when } : null;
  }
  const days: number[] = [];
  for (const word of when.split(',')) {
    const day = WEEKDAYS.indexOf(word.trim().slice(0, 3).toLowerCase());
    if (day < 0) return null;
    days.push(day);
  }
  return { kind: 'weekdays', days };
}

/**
 * Reads the schedule file: one event per line, e.g. "every day 5:00 PM Supper", "Tue,Fri 3 PM Phone call",
 * "2026-10-22 2:00 PM Doctor visit". Blank lines, "#" comments and lines it can't read are skipped.
 */
export function parseSchedule(text: string): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(LINE);
    if (!match) continue;
    const repeat = parseRepeat(match[1]);
    const minutes = parseTime(match[2]);
    if (!repeat || minutes === null) continue;
    events.push({ name: match[3].trim(), minutes, repeat });
  }
  return events;
}
