import { START_CROP, type CropAt } from '../src/jigsaw/crop';

/** What captions.txt says about one photo. */
export interface StarterNote {
  caption: string;
  keep: CropAt;
}

/** Which part of a photo to keep, from words like "top", "bottom left", "top-left" or "middle". */
export function keepAt(words: string): CropAt {
  const keep = { ...START_CROP };
  for (const word of words.toLowerCase().split(/[^a-z]+/)) {
    if (word === 'left') keep.x = 0;
    else if (word === 'center') keep.x = 0.5;
    else if (word === 'right') keep.x = 1;
    else if (word === 'top') keep.y = 0;
    else if (word === 'middle') keep.y = 0.5;
    else if (word === 'bottom') keep.y = 1;
  }
  return keep;
}

/**
 * captions.txt: one line per photo, "file name | caption | keep". A caption may contain "|"
 * when the line also has a keep field. Blank lines and lines starting with # are skipped.
 */
export function parseCaptions(text: string): Map<string, StarterNote> {
  const notes = new Map<string, StarterNote>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [file, ...rest] = trimmed.split('|').map((part) => part.trim());
    // With three or more fields the last is the keep words; everything between is the caption.
    const keep = rest.length >= 2 ? rest.pop()! : '';
    const caption = rest.join(' | ');
    if (file) notes.set(file, { caption, keep: keepAt(keep) });
  }
  return notes;
}

/** A picture's id from its file name: "Lake Louise.JPG" is "lake-louise", "Café.jpg" is "cafe". */
export function slug(file: string): string {
  const name = file
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name || 'picture';
}

/** Ids for the files, in order; a name used twice gets "-2", "-3"… and never clashes with another id. */
export function uniqueIds(files: readonly string[]): string[] {
  const taken = new Set<string>();
  return files.map((file) => {
    const base = slug(file);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    return id;
  });
}

/** The photos in captions.txt come first, in its order; the others follow by name, numbers in order. */
export function starterOrder(files: readonly string[], listed: readonly string[]): string[] {
  const first = [...new Set(listed)].filter((file) => files.includes(file));
  const rest = files
    .filter((file) => !first.includes(file))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return [...first, ...rest];
}
