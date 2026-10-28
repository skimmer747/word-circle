import { clamp01, cropRect, type CropAt } from '../jigsaw/crop';

/** A family photo is kept whole with its long side at most this, so its framing can change later. */
export const WHOLE_MAX = 2000;
/** The framed copy the puzzle is cut from, the size of a starter picture. */
export const FRAMED = { w: 1600, h: 1200 } as const;
/** Its thumbnail on "Pick a picture". */
export const THUMB = { w: 448, h: 336 } as const;
/** A caption is at most this many characters... */
export const MAX_CAPTION = 80;
/** ...on at most this many lines. */
const MAX_CAPTION_LINES = 2;

/** The size a width × height photo is kept at: its long side at most `max`, never made bigger. */
export function fitLongSide(width: number, height: number, max = WHOLE_MAX): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) };
}

/**
 * She dragged the photo by (dx, dy) screen px from where it was with the frame `at`, while the photo is shown at
 * `scale` times its size: the frame moves the other way across the photo, never outside it.
 */
export function dragFrame(at: Readonly<CropAt>, width: number, height: number, scale: number, dx: number, dy: number): CropAt {
  const crop = cropRect(width, height, at);
  const spareW = width - crop.w;
  const spareH = height - crop.h;
  return {
    x: spareW > 0 ? clamp01(at.x - dx / scale / spareW) : at.x,
    y: spareH > 0 ? clamp01(at.y - dy / scale / spareH) : at.y,
  };
}

/** A caption as saved: at most two lines, each trimmed with single spaces, and at most 80 characters in all. */
export function cleanCaption(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
  return lines.slice(0, MAX_CAPTION_LINES).join('\n').slice(0, MAX_CAPTION).trim();
}

/** A new family photo's id: the time and a random part, letters and digits only, so it's safe in a picture id. */
export function newPhotoId(now: number, random: () => number = Math.random): string {
  return `${Math.max(0, Math.floor(now)).toString(36)}${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
}
