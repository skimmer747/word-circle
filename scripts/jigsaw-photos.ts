/**
 * Makes Jigsaw's starter pictures from the originals in photos/starter/ (kept out of git): frames each to 4:3,
 * shrinks it to 1600 × 1200 with a 448 × 336 thumbnail, and writes public/jigsaw/ with starters.json, plus the
 * review page docs/jigsaw-starters.html. Captions and which part to keep go in photos/starter/captions.txt.
 *
 *   npm run jigsaw-photos                  after adding photos (and captions.txt lines)
 *   npm run jigsaw-photos -- --stand-ins   first makes six plain numbered test pictures there
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { cropRect } from '../src/jigsaw/crop';
import { parseCaptions, starterOrder, uniqueIds } from './jigsaw-lib';

const SOURCE = 'photos/starter';
const OUT = 'public/jigsaw';
const REVIEW = 'docs/jigsaw-starters.html';
const PHOTO = { w: 1600, h: 1200 };
const THUMB = { w: 448, h: 336 };
const IMAGE = /\.(jpe?g|png|heic|heif|webp)$/i;

interface Starter {
  id: string;
  file: string;
  thumb: string;
  caption: string;
}

/** Six plain pictures with big numbers, for building and testing before the real ones arrive. */
async function makeStandIns(): Promise<void> {
  mkdirSync(SOURCE, { recursive: true });
  const skies = ['#9fd3f5', '#f6c87a', '#c9b8f0', '#a8e0c8', '#f5b3b3', '#b3d1f5'];
  const lands = ['#4e9a47', '#8db255', '#5b7db1', '#2e8b57', '#b1475b', '#7a5bd6'];
  const lines = ['# Stand-in pictures for testing. Replace them with real ones before publishing.'];
  for (let i = 0; i < skies.length; i++) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200">
      <rect width="1600" height="1200" fill="${skies[i]}"/>
      <circle cx="1250" cy="260" r="140" fill="#f7c948"/>
      <path d="M0 760 Q400 520 800 700 T1600 640 L1600 1200 L0 1200 Z" fill="${lands[i]}"/>
      <text x="800" y="800" font-family="Helvetica, Arial, sans-serif" font-size="520" font-weight="700"
        text-anchor="middle" fill="#ffffff" stroke="#1b3a6b" stroke-width="16">${i + 1}</text>
    </svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(join(SOURCE, `stand-in-${i + 1}.jpg`));
    lines.push(`stand-in-${i + 1}.jpg | Test picture ${i + 1}`);
  }
  writeFileSync(join(SOURCE, 'captions.txt'), `${lines.join('\n')}\n`);
}

/** iPhone photos (HEIC) become JPEGs first, with macOS's own sips. */
function readable(file: string, scratch: string): string {
  const path = join(SOURCE, file);
  if (!/\.hei[cf]$/i.test(file)) return path;
  const out = join(scratch, `${file}.jpg`);
  execFileSync('sips', ['-s', 'format', 'jpeg', path, '--out', out], { stdio: 'ignore' });
  return out;
}

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function reviewPage(starters: readonly Starter[]): string {
  const tiles = starters
    .map(
      (s) =>
        `<figure><img src="../public/jigsaw/${s.thumb}" alt=""><figcaption><b>${escape(s.id)}</b><br>${
          s.caption ? escape(s.caption) : '<i>no caption</i>'
        }</figcaption></figure>`,
    )
    .join('\n');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Jigsaw starter pictures</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;background:#d8eaf7}main{display:grid;grid-template-columns:repeat(auto-fill,224px);gap:16px}figure{margin:0}img{display:block;width:224px;height:168px;border-radius:8px}figcaption{margin-top:4px;font-size:14px}</style>
</head><body><h1>Jigsaw starter pictures (${starters.length})</h1><main>
${tiles}
</main></body></html>
`;
}

async function main(): Promise<void> {
  if (process.argv.includes('--stand-ins')) await makeStandIns();
  if (!existsSync(SOURCE)) throw new Error(`Put the starter photos in ${SOURCE}/ first.`);
  const notesFile = join(SOURCE, 'captions.txt');
  const notes = parseCaptions(existsSync(notesFile) ? readFileSync(notesFile, 'utf8') : '');
  const present = readdirSync(SOURCE);
  // A misspelled or wrongly capitalized line would otherwise just be ignored.
  for (const listed of notes.keys()) {
    if (!present.includes(listed)) console.warn(`Listed in captions.txt but not found: ${listed} (check the spelling and capitals)`);
  }
  const files = starterOrder(present.filter((file) => IMAGE.test(file)), [...notes.keys()]);
  if (files.length === 0) throw new Error(`No photos in ${SOURCE}/.`);
  // Ids name the published files and key saved progress, so they come from the file names alone:
  // reordering captions.txt must never change them.
  const byName = [...files].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const idOf = new Map(uniqueIds(byName).map((id, i) => [byName[i], id]));

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'jigsaw-'));
  const starters: Starter[] = [];
  try {
    for (const file of files) {
      const id = idOf.get(file)!;
      // Turned the right way up first: phones save sideways photos with a note saying which way to turn them.
      const { data, info } = await sharp(readable(file, scratch)).rotate().toBuffer({ resolveWithObject: true });
      const note = notes.get(file);
      const crop = cropRect(info.width, info.height, note?.keep);
      if (crop.w === 0 || crop.h === 0) {
        console.warn(`Too small, skipped: ${file}`);
        continue;
      }
      const framed = sharp(data).extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h });
      await framed.clone().resize(PHOTO.w, PHOTO.h).jpeg({ quality: 82, mozjpeg: true }).toFile(join(OUT, `${id}.jpg`));
      await framed.clone().resize(THUMB.w, THUMB.h).jpeg({ quality: 80, mozjpeg: true }).toFile(join(OUT, `${id}-thumb.jpg`));
      starters.push({ id, file: `${id}.jpg`, thumb: `${id}-thumb.jpg`, caption: note?.caption ?? '' });
      console.log(`${file} → ${id}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  writeFileSync(join(OUT, 'starters.json'), `${JSON.stringify(starters, null, 2)}\n`);
  writeFileSync(REVIEW, reviewPage(starters));
  console.log(`${starters.length} starter pictures in ${OUT}/. Look them over in ${REVIEW}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
