import { markGuess, type Mark } from './rules';

const SQUARES: Record<Mark, string> = { right: '🟩', present: '🟨', absent: '⬜' };

/**
 * Her result in Wordle's own format, for texting to family: "Wordle 1,948 4/6", a blank line, then one row of
 * squares per guess. More than six tries reads "in 8 tries"; a word finished by Hint ends with a green row,
 * counted as a try.
 */
export function shareText(number: number, answer: string, guesses: readonly string[], finishedByHint: boolean): string {
  const rows = guesses.map((guess) => markGuess(guess, answer).map((mark) => SQUARES[mark]).join(''));
  if (finishedByHint) rows.push(SQUARES.right.repeat(answer.length));
  const score = rows.length <= 6 ? `${rows.length}/6` : `in ${rows.length} tries`;
  return `Wordle ${number.toLocaleString('en-US')} ${score}\n\n${rows.join('\n')}`;
}
