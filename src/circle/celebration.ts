import type { CelebrationLine } from '../frame/view';
import { CALENDAR_ICON, STAR_ICON, SUN_ICON, TROPHY_ICON } from '../ui/icons';
import { formatDuration, type Celebration } from './stats';

/** The good news after a puzzle. Days in a row appears from day two. */
export function circleLines(c: Celebration): CelebrationLine[] {
  const lines: CelebrationLine[] = [];
  if (c.recordMs !== null) {
    lines.push({ kind: 'row-record', icon: TROPHY_ICON, text: `New record! ${formatDuration(c.recordMs)}`, highlight: true });
  }
  if (c.streakDays >= 2) {
    lines.push({ kind: 'row-streak', icon: CALENDAR_ICON, text: `${c.streakDays} days in a row`, highlight: false });
  }
  lines.push({
    kind: 'row-today',
    icon: SUN_ICON,
    text: `${c.todaySolved} ${c.todaySolved === 1 ? 'puzzle' : 'puzzles'} today`,
    highlight: false,
  });
  lines.push({
    kind: 'row-number',
    icon: STAR_ICON,
    text: `Puzzle number ${c.puzzleNumber}${c.milestone ? '!' : ''}`,
    highlight: c.milestone,
  });
  return lines;
}
