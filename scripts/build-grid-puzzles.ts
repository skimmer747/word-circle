import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPuzzle } from '../src/grid/puzzle';
import { GRID_LEVELS, type GridLevel, type GridPuzzleSet } from '../src/grid/types';
import { seededRandom } from '../src/shared/random';
import {
  buildGridWordLists,
  buildLevel,
  levelProblems,
  PatternIndex,
  puzzleProblems,
  wordsByLength,
  type LevelRules,
} from './grid-lib';
import { renderGridSamplePage } from './grid-sample-page';
import { readBlocklist, readNeverUse, readScowl } from './scowl';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCOWL_DIR = path.join(ROOT, 'words/scowl/final');
const SKIP_FILE = path.join(ROOT, 'words/guess-skip.txt');
const PUZZLES_FILE = path.join(ROOT, 'src/data/grid-puzzles.json');
const WORDS_FILE = path.join(ROOT, 'src/data/grid-words.json');
const SAMPLE_FILE = path.join(ROOT, 'docs/grid-sample.html');

const SEED = 20261020;
/** Answers come from common words... */
const COMMON_MAX_SIZE = 20;
/** ...and any word up to this SCOWL size counts as a real word. */
const ALL_MAX_SIZE = 60;
const SAMPLE_SIZE = 20;

interface LevelPlan extends LevelRules {
  count: number;
  /** Fail the build below this, so the rules can be revisited. */
  minimum: number;
}

const PLANS: Record<GridLevel, LevelPlan> = {
  easy: { size: 4, maxSection: 3, count: 500, minimum: 400 },
  medium: { size: 5, maxSection: 4, count: 500, minimum: 400 },
  hard: { size: 6, maxSection: 4, count: 500, minimum: 400 },
};

const lists = buildGridWordLists({
  common: readScowl(SCOWL_DIR, COMMON_MAX_SIZE).keys(),
  all: readScowl(SCOWL_DIR, ALL_MAX_SIZE).keys(),
  neverUse: readNeverUse(ROOT),
  skip: readBlocklist(SKIP_FILE),
});
const indexes = { answers: new PatternIndex(lists.answers), words: new PatternIndex(lists.words) };
const answers = new Set(lists.answers);
const byLength = wordsByLength(lists.words);

const problems: string[] = [];
const set = {} as GridPuzzleSet;
GRID_LEVELS.forEach((level, i) => {
  const plan = PLANS[level];
  const started = Date.now();
  const puzzles = buildLevel(plan, indexes, plan.count, seededRandom(SEED + i));
  console.log(`${level}: ${puzzles.length} puzzles in ${Math.round((Date.now() - started) / 1000)} s`);
  problems.push(...puzzles.flatMap((puzzle) => puzzleProblems(puzzle, plan, answers, byLength)));
  problems.push(...levelProblems(level, puzzles, plan.minimum));
  set[level] = puzzles;
});
if (problems.length > 0) {
  console.error(problems.slice(0, 50).join('\n'));
  process.exit(1);
}

const json = GRID_LEVELS.map((level) => `"${level}": [\n${set[level].map((p) => JSON.stringify(p)).join(',\n')}\n]`);
fs.writeFileSync(PUZZLES_FILE, `{\n${json.join(',\n')}\n}\n`);
fs.writeFileSync(WORDS_FILE, `{"words": ${JSON.stringify(lists.words)}}\n`);

const used = new Set(
  GRID_LEVELS.flatMap((level) =>
    set[level].flatMap((puzzle) => {
      const shape = readPuzzle(puzzle);
      return shape.runs.map((run) => run.map((square) => shape.answer[square]).join(''));
    }),
  ),
);
const titles: Record<GridLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
fs.writeFileSync(
  SAMPLE_FILE,
  renderGridSamplePage(
    GRID_LEVELS.map((level) => ({ title: titles[level], puzzles: set[level].slice(0, SAMPLE_SIZE) })),
    [...used].sort(),
  ),
);

console.log(`Wrote ${GRID_LEVELS.map((level) => `${set[level].length} ${level}`).join(', ')} puzzles to src/data/grid-puzzles.json`);
console.log(`Wrote ${lists.words.length} real words to src/data/grid-words.json`);
console.log('Review page: docs/grid-sample.html');
