import { answerWords } from '../grid/puzzle';
import type { GridPuzzle } from '../grid/types';
import { dayKey } from '../shared/days';
import type { PlayLevel, PlayRecord } from './log';

/** How many words, their letters, and the first of the longest. */
export function wordFacts(words: readonly string[]): Pick<PlayRecord, 'words' | 'letters' | 'longest'> {
  let longest = '';
  for (const word of words) if (word.length > longest.length) longest = word;
  return { words: words.length, letters: words.reduce((n, word) => n + word.length, 0), longest };
}

const when = (now: Date): Pick<PlayRecord, 'day' | 'hour'> => ({ day: dayKey(now), hour: now.getHours() });

/** Word Circle: its answer words plus the extra words she found. Each Hint reveals one letter. */
export function circleRecord(p: {
  words: readonly string[];
  extras: readonly string[];
  revealed: Record<string, number[]>;
  level: PlayLevel;
  ms: number;
  now: Date;
}): PlayRecord {
  return {
    ...when(p.now),
    game: 'circle',
    level: p.level,
    ms: Math.round(p.ms),
    hints: Object.values(p.revealed).reduce((n, indices) => n + indices.length, 0),
    tries: 0,
    typed: true,
    daily: false,
    ...wordFacts([...p.words, ...p.extras]),
    first: '',
  };
}

/** Word Guess: one word, with her tries, Hint letters and first guess. */
export function guessRecord(p: {
  answer: string;
  guesses: readonly string[];
  hinted: readonly number[];
  typed: boolean;
  daily: boolean;
  ms: number;
  now: Date;
}): PlayRecord {
  return {
    ...when(p.now),
    game: 'guess',
    level: null,
    ms: Math.round(p.ms),
    hints: p.hinted.length,
    tries: p.guesses.length,
    typed: p.typed,
    daily: p.daily,
    ...wordFacts([p.answer]),
    first: p.guesses[0] ?? '',
  };
}

/** Word Grid: every word across and down in the answer. */
export function gridRecord(p: { puzzle: GridPuzzle; hinted: readonly number[]; level: PlayLevel; ms: number; now: Date }): PlayRecord {
  return {
    ...when(p.now),
    game: 'grid',
    level: p.level,
    ms: Math.round(p.ms),
    hints: p.hinted.length,
    tries: 0,
    typed: true,
    daily: false,
    ...wordFacts(answerWords(p.puzzle)),
    first: '',
  };
}
