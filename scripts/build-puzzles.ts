import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seededRandom } from '../src/shared/random';
import { readInflectedForms } from './inflections';
import { buildPuzzles, validatePuzzle } from './puzzle-lib';
import { renderSamplePage } from './sample-page';
import { readBlocklist, readScowl } from './scowl';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCOWL_DIR = path.join(ROOT, 'words/scowl/final');
const INFLECTIONS_FILE = path.join(ROOT, 'words/agid/infl.txt');
const BLOCKLIST_FILE = path.join(ROOT, 'words/blocklist.txt');
const TABOO_FILES = ['offensive.1', 'offensive.2', 'profane.1', 'profane.3'].map((name) =>
  path.join(ROOT, 'words/scowl/misc', name),
);
const OUTPUT_FILE = path.join(ROOT, 'src/data/puzzles.json');
const SAMPLE_FILE = path.join(ROOT, 'docs/puzzle-sample.html');

const SEED = 20261019;
const ANSWER_MAX_SIZE = 35;
const ACCEPTED_MAX_SIZE = 60;
const FIVE_LETTER_TARGET = 1125;
const SIX_LETTER_TARGET = 375;
const MINIMUM_PUZZLES = 800;
const SAMPLE_SIZE = 60;

const blocklist = new Set([BLOCKLIST_FILE, ...TABOO_FILES].flatMap((file) => [...readBlocklist(file)]));
// Slots hold plain dictionary words only; plurals and other endings still count as extra words.
const inflected = readInflectedForms(INFLECTIONS_FILE);
const answers = new Map([...readScowl(SCOWL_DIR, ANSWER_MAX_SIZE)].filter(([word]) => !inflected.has(word)));
const puzzles = buildPuzzles({
  answers,
  accepted: new Set(readScowl(SCOWL_DIR, ACCEPTED_MAX_SIZE).keys()),
  blocklist,
  random: seededRandom(SEED),
  fiveLetterTarget: FIVE_LETTER_TARGET,
  sixLetterTarget: SIX_LETTER_TARGET,
});

const problems = puzzles.flatMap((puzzle) => validatePuzzle(puzzle, blocklist));
if (new Set(puzzles.map((p) => p.id)).size !== puzzles.length) problems.push('Two puzzles share the same letters');
if (puzzles.length < MINIMUM_PUZZLES) {
  problems.push(`Only ${puzzles.length} puzzles could be made (need at least ${MINIMUM_PUZZLES})`);
}
if (problems.length > 0) {
  console.error(problems.slice(0, 50).join('\n'));
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `[\n${puzzles.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`);
fs.writeFileSync(SAMPLE_FILE, renderSamplePage(puzzles.slice(0, SAMPLE_SIZE)));

const five = puzzles.filter((p) => p.letters.length === 5).length;
console.log(`Wrote ${puzzles.length} puzzles (${five} five-letter, ${puzzles.length - five} six-letter) to src/data/puzzles.json`);
console.log('Sample page: docs/puzzle-sample.html');
