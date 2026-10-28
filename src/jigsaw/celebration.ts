import type { CelebrationLine } from '../frame/view';
import { isMilestone } from '../shared/days';
import { CALENDAR_ICON, STAR_ICON, SUN_ICON, TARGET_ICON } from '../ui/icons';

export interface JigsawResult {
  /** She used Hint on this jigsaw. */
  hinted: boolean;
  streakDays: number;
  todaySolved: number;
  /** Jigsaws finished in all, this one included. */
  puzzleNumber: number;
}

/** The good news after a jigsaw: only ever good news, at most four lines. */
export function jigsawLines(r: JigsawResult): CelebrationLine[] {
  const lines: CelebrationLine[] = [];
  if (!r.hinted) lines.push({ kind: 'row-nohints', icon: TARGET_ICON, text: 'Done with no hints', highlight: false });
  if (r.streakDays >= 2) lines.push({ kind: 'row-streak', icon: CALENDAR_ICON, text: `${r.streakDays} days in a row`, highlight: false });
  lines.push({ kind: 'row-today', icon: SUN_ICON, text: `${r.todaySolved} ${r.todaySolved === 1 ? 'jigsaw' : 'jigsaws'} today`, highlight: false });
  const milestone = isMilestone(r.puzzleNumber);
  lines.push({ kind: 'row-number', icon: STAR_ICON, text: `Jigsaw number ${r.puzzleNumber}${milestone ? '!' : ''}`, highlight: milestone });
  return lines;
}
