import { START_CROP, type CropAt } from '../src/jigsaw/crop';

/** What captions.txt says about one photo. */
export interface StarterNote {
  caption: string;
  keep: CropAt;
}

/** Which part of a photo to keep, from words like "top", "bottom left" or "middle". */
export function keepAt(words: string): CropAt {
  const keep = { ...START_CROP };
  for (const word of words.toLowerCase().split(/[\s,]+/)) {
    if (word === 'left') keep.x = 0;
    else if (word === 'center') keep.x = 0.5;
    else if (word === 'right') keep.x = 1;
    else if (word === 'top') keep.y = 0;
    else if (word === 'middle') keep.y = 0.5;
    else if (word === 'bottom') keep.y = 1;
  }
  return keep;
}

/** captions.txt: one line per photo, "file name | caption | keep". Blank lines and lines starting with # are skipped. */
export function parseCaptions(text: string): Map<string, StarterNote> {
  const notes = new Map<string, StarterNote>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [file, caption = '', keep = ''] = trimmed.split('|').map((part) => part.trim());
    if (file) notes.set(file, { caption, keep: keepAt(keep) });
  }
  return notes;
}

/** A picture's id from its file name: "Lake Louise.JPG" is "lake-louise". */
export function slug(file: string): string {
  const name = file
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name || 'picture';
}

/** Ids for the files, in order; a name used twice gets "-2", "-3"… */
export function uniqueIds(files: readonly string[]): string[] {
  const used = new Map<string, number>();
  return files.map((file) => {
    const base = slug(file);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  });
}

/** The photos in captions.txt come first, in its order; the others follow by name. */
export function starterOrder(files: readonly string[], listed: readonly string[]): string[] {
  const first = listed.filter((file) => files.includes(file));
  const rest = files.filter((file) => !first.includes(file)).sort((a, b) => a.localeCompare(b));
  return [...first, ...rest];
}
