import { describe, expect, it } from 'vitest';
import {
  computeLayout,
  SAFE_ZONE_LEFT_MIN,
  SAFE_ZONE_LEFT_TARGET,
  SAFE_ZONE_RIGHT,
  type Circle,
  type Layout,
  type Rect,
} from '../src/circle/layout';

const SCREENS: Array<[number, number]> = [
  [1024, 768],
  [1080, 810],
  [1133, 744],
  [1180, 820],
  [1194, 834],
  [1366, 1024],
  [1376, 1032],
];

const PUZZLE_SHAPES = [
  { letterCount: 4, wordLengths: [3, 3, 4, 4] },
  { letterCount: 5, wordLengths: [3, 3, 3, 4, 4, 5] },
  { letterCount: 6, wordLengths: [3, 4, 5, 6, 6, 6] },
  { letterCount: 5, wordLengths: [3, 4, 4, 5] },
];

const circleRect = (c: Circle): Rect => ({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });

function inPlayArea(rect: Rect, layout: Layout): boolean {
  return (
    rect.x >= layout.safeZoneLeft &&
    rect.x + rect.w <= layout.width - layout.safeZoneRight &&
    rect.y >= 0 &&
    rect.y + rect.h <= layout.height
  );
}

describe.each(SCREENS)('layout on a %i×%i screen', (width, height) => {
  describe.each(PUZZLE_SHAPES)('with $letterCount letters and words $wordLengths', (shape) => {
    const layout = computeLayout({ width, height, ...shape });

    it('keeps everything out of the safe zones and on screen', () => {
      const rects = [
        ...layout.levels,
        layout.extras,
        layout.bar,
        layout.shuffleButton,
        layout.hintButton,
        ...layout.rows,
        circleRect(layout.backing),
        ...layout.tiles.map(circleRect),
      ];
      for (const rect of rects) expect(inPlayArea(rect, layout), JSON.stringify(rect)).toBe(true);
    });

    it('gives her left thumb a wider safe zone where the screen has room', () => {
      expect(layout.safeZoneRight).toBe(SAFE_ZONE_RIGHT);
      expect(layout.safeZoneLeft).toBeGreaterThanOrEqual(SAFE_ZONE_LEFT_MIN);
      expect(layout.safeZoneLeft).toBeLessThanOrEqual(SAFE_ZONE_LEFT_TARGET);
      if (width >= 1133) expect(layout.safeZoneLeft).toBe(SAFE_ZONE_LEFT_TARGET);
    });

    it('makes letter tiles at least 110 px across', () => {
      for (const tile of layout.tiles) expect(tile.r * 2).toBeGreaterThanOrEqual(110);
    });

    it('keeps tiles inside the circle and far enough apart that start areas never overlap', () => {
      const { backing, tiles } = layout;
      for (const t of tiles) {
        expect(Math.hypot(t.x - backing.x, t.y - backing.y) + t.r).toBeLessThanOrEqual(backing.r + 0.001);
      }
      tiles.forEach((a, i) => {
        const b = tiles[(i + 1) % tiles.length];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r * 2 * 1.15);
      });
    });

    it('sizes word slots between 48 and 72 px', () => {
      expect(layout.slotSize).toBeGreaterThanOrEqual(48);
      expect(layout.slotSize).toBeLessThanOrEqual(72);
    });

    it('stacks word rows above the buttons without overlapping', () => {
      layout.rows.forEach((row, i) => {
        if (i > 0) expect(row.y).toBeGreaterThanOrEqual(layout.rows[i - 1].y + layout.rows[i - 1].h);
      });
      const last = layout.rows[layout.rows.length - 1];
      expect(last.y + last.h).toBeLessThanOrEqual(layout.shuffleButton.y);
    });

    it('puts Extra words at the top right, above the word bar and letter circle', () => {
      const { extras, bar, backing } = layout;
      expect(extras.h).toBeGreaterThanOrEqual(120);
      expect(extras.y + extras.h).toBeLessThanOrEqual(bar.y);
      expect(bar.y + bar.h).toBeLessThanOrEqual(backing.y - backing.r);
      expect(extras.x + extras.w).toBeGreaterThan(backing.x);
    });

    it('puts three small level buttons in a row at the top left, above the word slots', () => {
      const { levels, rows } = layout;
      expect(levels).toHaveLength(3);
      levels.forEach((button, i) => {
        expect(button.h).toBeGreaterThanOrEqual(44);
        expect(button.w).toBeLessThanOrEqual(120);
        expect(button.y + button.h).toBeLessThanOrEqual(rows[0].y);
        if (i > 0) expect(button.x).toBeGreaterThanOrEqual(levels[i - 1].x + levels[i - 1].w);
      });
    });

    it('keeps the left column clear of the right column', () => {
      const rightColumnStart = Math.min(layout.extras.x, layout.bar.x, layout.backing.x - layout.backing.r);
      for (const rect of [...layout.levels, ...layout.rows, layout.shuffleButton, layout.hintButton]) {
        expect(rect.x + rect.w).toBeLessThanOrEqual(rightColumnStart);
      }
    });

    it('fills almost the whole screen with the celebration card, with a big Next button clear of the safe zones', () => {
      const { celebration, nextButton } = layout;
      expect(celebration.x).toBeGreaterThanOrEqual(0);
      expect(celebration.y).toBeGreaterThanOrEqual(0);
      expect(celebration.x + celebration.w).toBeLessThanOrEqual(width);
      expect(celebration.y + celebration.h).toBeLessThanOrEqual(height);
      expect(celebration.w).toBeGreaterThanOrEqual(width - 40);
      expect(celebration.h).toBeGreaterThanOrEqual(height - 40);
      expect(inPlayArea(nextButton, layout)).toBe(true);
      expect(nextButton.h).toBeGreaterThanOrEqual(96);
      expect(nextButton.w).toBeGreaterThanOrEqual(400);
      expect(Math.abs(nextButton.x + nextButton.w / 2 - width / 2)).toBeLessThan(1);
      expect(nextButton.y + nextButton.h).toBeLessThanOrEqual(celebration.y + celebration.h);
    });

    it('puts the clock button at the top right, beside Extra words', () => {
      const { clockButton, extras, bar } = layout;
      expect(inPlayArea(clockButton, layout)).toBe(true);
      expect(clockButton.w).toBeGreaterThanOrEqual(64);
      expect(clockButton.h).toBeGreaterThanOrEqual(64);
      expect(clockButton.x + clockButton.w).toBeCloseTo(width - layout.safeZoneRight - 16, 5);
      expect(extras.x + extras.w).toBeLessThanOrEqual(clockButton.x);
      expect(clockButton.y + clockButton.h).toBeLessThanOrEqual(bar.y);
    });

    it('makes the clock pop-up fill almost the whole screen, with a big Close button clear of the safe zones', () => {
      const { clockCard, closeButton } = layout;
      expect(clockCard.x).toBeGreaterThanOrEqual(0);
      expect(clockCard.y).toBeGreaterThanOrEqual(0);
      expect(clockCard.x + clockCard.w).toBeLessThanOrEqual(width);
      expect(clockCard.y + clockCard.h).toBeLessThanOrEqual(height);
      expect(clockCard.w).toBeGreaterThanOrEqual(width - 40);
      expect(clockCard.h).toBeGreaterThanOrEqual(height - 40);
      expect(inPlayArea(closeButton, layout)).toBe(true);
      expect(closeButton.h).toBeGreaterThanOrEqual(96);
      expect(closeButton.w).toBeGreaterThanOrEqual(340);
      expect(closeButton.y + closeButton.h).toBeLessThanOrEqual(clockCard.y + clockCard.h);
    });

    it('makes buttons at least 90 px tall', () => {
      expect(layout.shuffleButton.h).toBeGreaterThanOrEqual(90);
      expect(layout.hintButton.h).toBeGreaterThanOrEqual(90);
    });
  });
});
