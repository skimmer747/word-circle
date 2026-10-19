import type { ScheduledEvent } from './schedule';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
/** "Time for Supper" from this many minutes before until TIME_FOR_AFTER after. */
const TIME_FOR_BEFORE = 5;
const TIME_FOR_AFTER = 30;
const WEEK_AHEAD_DAYS = 7;

export interface ClockFace {
  /** "10:30 AM" */
  time: string;
  /** "in the morning", "in the afternoon", "in the evening" or "at night" */
  part: string;
  /** "Monday, October 19" */
  date: string;
}

function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

function partOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return 'in the morning';
  if (hour >= 12 && hour < 17) return 'in the afternoon';
  if (hour >= 17 && hour < 21) return 'in the evening';
  return 'at night';
}

export function clockFace(now: Date): ClockFace {
  return {
    time: formatTime(now.getHours() * 60 + now.getMinutes()),
    part: partOfDay(now.getHours()),
    date: `${DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`,
  };
}

/** "1 hour", "4 hours 30 minutes", "45 minutes". */
function formatWait(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (hours === 0) return part(minutes, 'minute');
  return minutes === 0 ? part(hours, 'hour') : `${part(hours, 'hour')} ${part(minutes, 'minute')}`;
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function happensOn(event: ScheduledEvent, day: Date): boolean {
  switch (event.repeat.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return event.repeat.days.includes(day.getDay());
    case 'date':
      return event.repeat.date === dateKey(day);
  }
}

/**
 * What's coming up, soonest first: countdowns for the rest of today ("Supper in 4 hours 30 minutes",
 * or "Time for Supper" around its start), then one-off events in the next week ("Doctor visit on Thursday at 2:00 PM").
 */
export function upcomingLines(events: readonly ScheduledEvent[], now: Date, max = 4): string[] {
  const lines: Array<{ at: number; text: string }> = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const event of events) {
    if (happensOn(event, today)) {
      const at = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, event.minutes);
      const wait = (at.getTime() - now.getTime()) / 60_000;
      if (wait >= -TIME_FOR_AFTER && wait <= TIME_FOR_BEFORE) lines.push({ at: at.getTime(), text: `Time for ${event.name}` });
      else if (wait > TIME_FOR_BEFORE) lines.push({ at: at.getTime(), text: `${event.name} in ${formatWait(Math.ceil(wait))}` });
    }
    if (event.repeat.kind !== 'date') continue;
    for (let ahead = 1; ahead <= WEEK_AHEAD_DAYS; ahead++) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ahead);
      if (!happensOn(event, day)) continue;
      const when = ahead === 1 ? 'tomorrow' : `on ${DAY_NAMES[day.getDay()]}`;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, event.minutes);
      lines.push({ at: at.getTime(), text: `${event.name} ${when} at ${formatTime(event.minutes)}` });
    }
  }
  return lines
    .sort((a, b) => a.at - b.at)
    .slice(0, max)
    .map((line) => line.text);
}
