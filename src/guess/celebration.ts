import type { CelebrationLine } from '../frame/view';
import { isMilestone } from '../shared/days';
import { CALENDAR_ICON, NEWS_ICON, STAR_ICON, SUN_ICON, TARGET_ICON } from '../ui/icons';

export interface GuessResult {
  /** How many guesses she made. */
  tries: number;
  /** She typed the winning word herself (a hint didn't finish it). */
  typed: boolean;
  /** It was today's Wordle. */
  daily: boolean;
  streakDays: number;
  todaySolved: number;
  /** Word Guess words finished in all, this one included. */
  wordNumber: number;
}

/** The good news after a word: at most four lines, so the card fits under her word on every iPad. */
export function guessLines(r: GuessResult): CelebrationLine[] {
  const lines: CelebrationLine[] = [];
  const tries = r.typed && r.tries <= 6 ? `${r.tries} ${r.tries === 1 ? 'try' : 'tries'}` : null;
  if (r.daily) {
    lines.push({
      kind: 'row-daily',
      icon: NEWS_ICON,
      text: tries ? `Today's Wordle in ${tries}` : "That was today's Wordle",
      highlight: true,
    });
  } else if (tries) {
    lines.push({ kind: 'row-tries', icon: TARGET_ICON, text: `Got it in ${tries}`, highlight: false });
  }
  if (r.streakDays >= 2) {
    lines.push({ kind: 'row-streak', icon: CALENDAR_ICON, text: `${r.streakDays} days in a row`, highlight: false });
  }
  lines.push({
    kind: 'row-today',
    icon: SUN_ICON,
    text: `${r.todaySolved} ${r.todaySolved === 1 ? 'word' : 'words'} today`,
    highlight: false,
  });
  const milestone = isMilestone(r.wordNumber);
  lines.push({ kind: 'row-number', icon: STAR_ICON, text: `Word number ${r.wordNumber}${milestone ? '!' : ''}`, highlight: milestone });
  return lines;
}
