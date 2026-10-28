import type { Picture } from './types';

/** "Pick a picture" shows six places: three across, two down. */
export const PAGE_SIZE = 6;

const ID = /^[a-z0-9-]+$/;

/** The published starters.json, checked entry by entry; anything odd is left out. `base` is the site's address. */
export function parseStarters(value: unknown, base: string): Picture[] {
  if (!Array.isArray(value)) return [];
  const pictures: Picture[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, file, thumb, caption } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !ID.test(id) || seen.has(id) || typeof file !== 'string' || typeof thumb !== 'string') continue;
    seen.add(id);
    pictures.push({
      id: `starter:${id}`,
      src: `${base}jigsaw/${file}`,
      thumb: `${base}jigsaw/${thumb}`,
      caption: typeof caption === 'string' ? caption.trim() : '',
    });
  }
  return pictures;
}

/** The starter pictures; none if the list can't be had (offline before the app ever saved it). */
export async function loadStarters(base: string, fetcher: (url: string) => Promise<Response> = (url) => fetch(url)): Promise<Picture[]> {
  try {
    const response = await fetcher(`${base}jigsaw/starters.json`);
    return response.ok ? parseStarters(await response.json(), base) : [];
  } catch {
    return [];
  }
}

export interface PicturePage {
  pictures: Picture[];
  /** The first one's place in the whole list. */
  first: number;
  hasBack: boolean;
  hasMore: boolean;
}

/** One page of `perPage` pictures (fewer than six when the page also holds the Add a photo tile). */
export function picturePage(pictures: readonly Picture[], page: number, perPage = PAGE_SIZE): PicturePage {
  const pages = Math.max(1, Math.ceil(pictures.length / perPage));
  const p = Math.min(Math.max(0, page), pages - 1);
  const first = p * perPage;
  return { pictures: pictures.slice(first, first + perPage), first, hasBack: p > 0, hasMore: p < pages - 1 };
}
