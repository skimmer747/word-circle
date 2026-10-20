import { formatTime } from '../clock/clock';
import { parseSchedule, type ScheduledEvent } from '../clock/schedule';

/** Weekday buttons and lines, 0 = Sunday. */
export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type RepeatChoice = 'once' | 'daily' | 'days';

/** What the caregiver filled in under "Add event". */
export interface EventEntry {
  what: string;
  repeat: RepeatChoice;
  /** "2026-10-22", from the date picker (Once only). */
  date: string;
  /** 0 = Sunday ... 6 = Saturday (Some days only). */
  days: number[];
  /** "18:00", from the time picker. */
  time: string;
}

/** The entry as a schedule.txt line ("every day 6:00 PM Supper"), or null until it's all filled in. */
export function eventLine(entry: EventEntry): string | null {
  const what = entry.what.replace(/\s+/g, ' ').trim();
  const time = /^(\d{2}):(\d{2})$/.exec(entry.time);
  if (!what || !time) return null;
  let when: string;
  if (entry.repeat === 'daily') {
    when = 'every day';
  } else if (entry.repeat === 'days') {
    const days = [...new Set(entry.days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
    if (days.length === 0) return null;
    when = days.map((day) => WEEKDAY_NAMES[day]).join(',');
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return null;
    when = entry.date;
  }
  const line = `${when} ${formatTime(Number(time[1]) * 60 + Number(time[2]))} ${what}`;
  // The clock's own reader has the last word, so a line it can't read is never saved.
  return parseSchedule(line).length === 1 ? line : null;
}

function repeatText({ repeat }: ScheduledEvent): string {
  if (repeat.kind === 'daily') return 'every day';
  if (repeat.kind === 'weekdays') return repeat.days.map((day) => WEEKDAY_NAMES[day]).join(', ');
  const [year, month, day] = repeat.date.split('-').map(Number);
  return `${WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()]} ${MONTH_NAMES[month - 1]} ${day}`;
}

/** "Supper · every day · 6:00 PM", for the list of events; null for a line that can't be read. */
export function eventRow(line: string): string | null {
  const [event] = parseSchedule(line);
  if (!event) return null;
  return `${event.name} · ${repeatText(event)} · ${formatTime(event.minutes)}`;
}

/** The lines still worth listing on `today` ("2026-10-19"): one-time events from earlier days, and lines that can't be read, are dropped. */
export function currentLines(lines: readonly string[], today: string): string[] {
  return lines.filter((line) => {
    const [event] = parseSchedule(line);
    return event !== undefined && !(event.repeat.kind === 'date' && event.repeat.date < today);
  });
}
