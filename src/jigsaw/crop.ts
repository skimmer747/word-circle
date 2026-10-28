import type { Rect } from '../frame/layout';

/** Where the frame sits in the photo's spare room: 0 is the left or top, 1 the right or bottom. */
export interface CropAt {
  x: number;
  y: number;
  /** How far it's zoomed in: 1 (or none) is as big as the photo allows, 2 is half as wide. */
  zoom?: number;
}

/** A frame starts centered across and a quarter of the way down, where faces usually are. */
export const START_CROP: Readonly<CropAt> = { x: 0.5, y: 0.25 };

/** Between 0 and 1: anything outside goes to the nearer end, and NaN to 0. */
export const clamp01 = (value: number) => (value > 0 ? Math.min(1, value) : 0);

/** How far a frame is zoomed in: never less than 1 (the photo's whole width or height). */
export const zoomOf = (at: Readonly<CropAt>): number => (at.zoom !== undefined && at.zoom > 1 ? at.zoom : 1);

/** The largest 4:3 rectangle inside a width × height photo (that much smaller when zoomed in), placed `at` within the spare room. */
export function cropRect(width: number, height: number, at: Readonly<CropAt> = START_CROP): Rect {
  // Whole steps of 4 across and 3 down: exactly 4:3, whole pixels, never outside the photo.
  const k = Math.floor(Math.min(width / 4, height / 3) / zoomOf(at));
  const [w, h] = [4 * k, 3 * k];
  return { x: Math.round((width - w) * clamp01(at.x)), y: Math.round((height - h) * clamp01(at.y)), w, h };
}
