import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, type Level, type PuzzleSet } from '../src/circle/types';
import { seededRandom } from '../src/shared/random';
import { readInflectedForms } from './inflections';
import { buildGuessWords, validateGuessWords } from './guess-lib';
import { buildPuzzles, validatePuzzle, type PuzzleShape } from './puzzle-lib';
import { renderSamplePage } from './sample-page';
import { readBlocklist, readScowl } from './scowl';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCOWL_DIR = path.join(ROOT, 'words/scowl/final');
const INFLECTIONS_FILE = path.join(ROOT, 'words/agid/infl.txt');
const BLOCKLIST_FILE = path.join(ROOT, 'words/blocklist.txt');
const NOT_PLAIN_FILE = path.join(ROOT, 'words/not-plain.txt');
const GUESS_SKIP_FILE = path.join(ROOT, 'words/guess-skip.txt');
const TABOO_FILES = ['offensive.1', 'offensive.2', 'profane.1', 'profane.3'].map((name) =>
  path.join(ROOT, 'words/scowl/misc', name),
);
const OUTPUT_FILE = path.join(ROOT, 'src/data/puzzles.json');
const SAMPLE_FILE = path.join(ROOT, 'docs/puzzle-sample.html');
const GUESS_OUTPUT_FILE = path.join(ROOT, 'src/data/guess-words.json');

const SEED = 20261019;
const ANSWER_MAX_SIZE = 35;
const ACCEPTED_MAX_SIZE = 60;
const SAMPLE_SIZE = 20;
/** Fail the build if Word Guess has fewer answers than this, so the word-list rules can be revisited. */
const GUESS_MINIMUM = 1500;

interface LevelPlan extends PuzzleShape {
  target: number;
  /** Fail the build below this, so the word-list rules can be revisited. */
  minimum: number;
}

const PLANS: Record<Level, LevelPlan> = {
  easy: { letterCount: 4, minWords: 3, maxWords: 4, target: 700, minimum: 500 },
  medium: { letterCount: 5, minWords: 4, maxWords: 6, target: 1400, minimum: 1000 },
  hard: { letterCount: 6, minWords: 6, maxWords: 6, target: 1000, minimum: 800 },
};

const blocklist = new Set([BLOCKLIST_FILE, ...TABOO_FILES].flatMap((file) => [...readBlocklist(file)]));
// Slots hold plain dictionary words only; plurals and other endings still count as extra words.
const inflected = new Set([...readInflectedForms(INFLECTIONS_FILE), ...readBlocklist(NOT_PLAIN_FILE)]);
const answers = new Map([...readScowl(SCOWL_DIR, ANSWER_MAX_SIZE)].filter(([word]) => !inflected.has(word)));
const accepted = new Set(readScowl(SCOWL_DIR, ACCEPTED_MAX_SIZE).keys());

const problems: string[] = [];
const set = {} as PuzzleSet;
LEVELS.forEach((level, i) => {
  const plan = PLANS[level];
  const puzzles = buildPuzzles({ answers, accepted, blocklist, random: seededRandom(SEED + i), ...plan });
  problems.push(...puzzles.flatMap((puzzle) => validatePuzzle(puzzle, blocklist, plan)));
  if (new Set(puzzles.map((p) => p.id)).size !== puzzles.length) problems.push(`${level}: two puzzles share the same letters`);
  if (puzzles.length < plan.minimum) {
    problems.push(`${level}: only ${puzzles.length} puzzles could be made (need at least ${plan.minimum})`);
  }
  set[level] = puzzles;
});

// Word Guess uses its own seed, so its lists never change the Word Circle puzzles.
const guessSkip = readBlocklist(GUESS_SKIP_FILE);
const guess = buildGuessWords({ answers, accepted, blocklist, skip: guessSkip, random: seededRandom(SEED + 100) });
problems.push(...validateGuessWords(guess, blocklist, inflected, guessSkip));
if (guess.answers.length < GUESS_MINIMUM) {
  problems.push(`Word Guess: only ${guess.answers.length} answers could be found (need at least ${GUESS_MINIMUM})`);
}
if (problems.length > 0) {
  console.error(problems.slice(0, 50).join('\n'));
  process.exit(1);
}

const json = LEVELS.map((level) => `"${level}": [\n${set[level].map((p) => JSON.stringify(p)).join(',\n')}\n]`);
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `{\n${json.join(',\n')}\n}\n`);
fs.writeFileSync(
  SAMPLE_FILE,
  renderSamplePage(
    LEVELS.map((level) => ({
      title: `${level[0].toUpperCase()}${level.slice(1)}`,
      puzzles: set[level].slice(0, SAMPLE_SIZE),
    })),
    guess.answers,
  ),
);
fs.writeFileSync(
  GUESS_OUTPUT_FILE,
  `{\n"answers": ${JSON.stringify(guess.answers)},\n"accepted": ${JSON.stringify(guess.accepted)}\n}\n`,
);

console.log(`Wrote ${LEVELS.map((level) => `${set[level].length} ${level}`).join(', ')} puzzles to src/data/puzzles.json`);
console.log('Sample page: docs/puzzle-sample.html');
console.log(`Wrote ${guess.answers.length} Word Guess answers and ${guess.accepted.length} accepted words to src/data/guess-words.json`);
