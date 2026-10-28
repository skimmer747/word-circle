import type { Rect } from '../frame/layout';

/** Where the frame sits in the photo's spare room: 0 is the left or top, 1 the right or bottom. */
export interface CropAt {
  x: number;
  y: number;
}

/** A frame starts centered across and a quarter of the way down, where faces usually are. */
export const START_CROP: CropAt = { x: 0.5, y: 0.25 };

const share = (value: number) => Math.min(1, Math.max(0, value));

/** The largest 4:3 rectangle inside a width × height photo, placed `at` within the spare room. */
export function cropRect(width: number, height: number, at: CropAt = START_CROP): Rect {
  // 4:3 in whole-number steps: 1500 * (4 / 3) in floating point can land a hair under 2000.
  const w = Math.floor(Math.min(width, (height * 4) / 3));
  const h = Math.floor((w * 3) / 4);
  return { x: Math.round((width - w) * share(at.x)), y: Math.round((height - h) * share(at.y)), w, h };
}
