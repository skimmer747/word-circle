import type { CelebrationLine } from '../frame/view';
import { isMilestone } from '../shared/days';
import { CALENDAR_ICON, STAR_ICON, SUN_ICON, TARGET_ICON } from '../ui/icons';

export interface GridResult {
  /** She used Hint on this puzzle. */
  hinted: boolean;
  streakDays: number;
  todaySolved: number;
  /** Word Grid puzzles finished in all, this one included. */
  puzzleNumber: number;
}

/** The good news after a puzzle: only ever good news, at most four lines. */
export function gridLines(r: GridResult): CelebrationLine[] {
  const lines: CelebrationLine[] = [];
  if (!r.hinted) lines.push({ kind: 'row-nohints', icon: TARGET_ICON, text: 'Solved with no hints', highlight: false });
  if (r.streakDays >= 2) {
    lines.push({ kind: 'row-streak', icon: CALENDAR_ICON, text: `${r.streakDays} days in a row`, highlight: false });
  }
  lines.push({
    kind: 'row-today',
    icon: SUN_ICON,
    text: `${r.todaySolved} ${r.todaySolved === 1 ? 'puzzle' : 'puzzles'} today`,
    highlight: false,
  });
  const milestone = isMilestone(r.puzzleNumber);
  lines.push({ kind: 'row-number', icon: STAR_ICON, text: `Puzzle number ${r.puzzleNumber}${milestone ? '!' : ''}`, highlight: milestone });
  return lines;
}
