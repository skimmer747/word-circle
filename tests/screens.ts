import { THUMBS, type Rect } from '../src/frame/layout';

/** Every current iPad in landscape, in CSS px. */
export const SCREENS: Array<[number, number]> = [
  [1024, 768],
  [1080, 810],
  [1133, 744],
  [1180, 820],
  [1194, 834],
  [1366, 1024],
  [1376, 1032],
];

/** Every iPad, with a thumb resting on the left, on the right, or neither. */
export const SCREENS_AND_THUMBS = SCREENS.flatMap(([width, height]) => THUMBS.map((thumb) => [width, height, thumb] as const));

export interface Zones {
  width: number;
  height: number;
  safeZoneLeft: number;
  safeZoneRight: number;
}

/** Clear of both thumb safe zones and on screen. */
export function inPlayArea(rect: Rect, zones: Zones): boolean {
  return (
    rect.x >= zones.safeZoneLeft &&
    rect.x + rect.w <= zones.width - zones.safeZoneRight + 0.001 &&
    rect.y >= 0 &&
    rect.y + rect.h <= zones.height + 0.001
  );
}

/** True if the two rectangles share any area (touching edges is fine). */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w - 0.001 && b.x < a.x + a.w - 0.001 && a.y < b.y + b.h - 0.001 && b.y < a.y + a.h - 0.001;
}
