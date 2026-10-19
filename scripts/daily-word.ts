// Fetches the daily Wordle words (yesterday through two days ahead) into public/daily-word.txt, which is
// published with the site. Run by the deploy workflow every morning; `--strict` fails when nothing could be
// fetched, so a scheduled run keeps the last good deploy. Logs only counts: the Actions logs are public.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DailyWord } from '../src/guess/daily';
import { datesAround, formatDailyFile, parseNytReply } from './daily-lib';
import { readNeverUse } from './scowl';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT_FILE = path.join(ROOT, 'public/daily-word.txt');
const strict = process.argv.includes('--strict');

const neverUse = readNeverUse(ROOT);
const words: DailyWord[] = [];
for (const date of datesAround(new Date())) {
  try {
    const response = await fetch(`https://www.nytimes.com/svc/wordle/v2/${date}.json`);
    if (!response.ok) {
      console.warn(`${date}: not available (HTTP ${response.status})`);
      continue;
    }
    const word = parseNytReply(await response.json(), date, neverUse);
    if (word) words.push(word);
    else console.warn(`${date}: skipped (unusable or on the never-use list)`);
  } catch (error) {
    console.warn(`${date}: could not fetch (${(error as Error).message})`);
  }
}

fs.writeFileSync(OUTPUT_FILE, formatDailyFile(words));
console.log(`Wrote ${words.length} daily word(s) to public/daily-word.txt`);
if (strict && words.length === 0) {
  console.error('No daily words could be fetched; stopping so the last deploy stays live.');
  process.exit(1);
}
