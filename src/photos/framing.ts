import type { Rect } from '../frame/layout';
import { clamp01, cropRect, zoomOf, type CropAt } from '../jigsaw/crop';
import type { Point } from '../jigsaw/types';

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
/** Zooming in stops at 3×... */
export const MAX_ZOOM = 3;
/** ...or sooner, so the framed part is never narrower than this (the puzzle is 1600 px wide: any less looks blurry). */
const MIN_FRAMED_WIDTH = 800;

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
    ...at,
    x: spareW > 0 ? clamp01(at.x - dx / scale / spareW) : at.x,
    y: spareH > 0 ? clamp01(at.y - dy / scale / spareH) : at.y,
  };
}

/** How far a width × height photo can be zoomed in. */
export function maxZoom(width: number, height: number): number {
  const widest = 4 * Math.min(width / 4, height / 3);
  return Math.max(1, Math.min(MAX_ZOOM, widest / MIN_FRAMED_WIDTH));
}

/** The frame `at` in the photo, not rounded to whole pixels (for following fingers smoothly). */
function exactCrop(width: number, height: number, at: Readonly<CropAt>): Rect {
  const zoom = zoomOf(at);
  const w = (4 * Math.min(width / 4, height / 3)) / zoom;
  const h = (3 * Math.min(width / 4, height / 3)) / zoom;
  return { x: (width - w) * clamp01(at.x), y: (height - h) * clamp01(at.y), w, h };
}

/** Where `offset` puts the frame within `room` px of spare photo (the middle when there's none). */
const spareAt = (room: number, offset: number) => (room > 0.5 ? clamp01(offset / room) : 0.5);

/**
 * Two fingers pinched the photo, shown with its frame at `frame` on screen: from `fromDist` apart around `fromMid` when
 * the frame was `start`, to `dist` apart around `mid`. It zooms by how far they spread (from the whole photo up to
 * `most`), and the spot of the photo under the fingers stays under them.
 */
export function pinchFrame(
  start: Readonly<CropAt>,
  width: number,
  height: number,
  frame: Rect,
  fromMid: Point,
  fromDist: number,
  mid: Point,
  dist: number,
  most: number,
): CropAt {
  if (!(fromDist > 0) || !(dist > 0)) return { ...start };
  const from = exactCrop(width, height, start);
  const fromScale = frame.w / from.w;
  // The spot of the photo under the fingers.
  const spotX = from.x + (fromMid.x - frame.x) / fromScale;
  const spotY = from.y + (fromMid.y - frame.y) / fromScale;
  const zoom = Math.min(Math.max(1, most), Math.max(1, (zoomOf(start) * dist) / fromDist));
  const base = Math.min(width / 4, height / 3);
  const w = (4 * base) / zoom;
  const h = (3 * base) / zoom;
  const scale = frame.w / w;
  return {
    x: spareAt(width - w, spotX - (mid.x - frame.x) / scale),
    y: spareAt(height - h, spotY - (mid.y - frame.y) / scale),
    zoom,
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
