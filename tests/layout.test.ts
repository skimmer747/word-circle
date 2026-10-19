import { describe, expect, it } from 'vitest';
import { computeLayout, SAFE_ZONE_WIDTH, type Circle, type Layout, type Rect } from '../src/ui/layout';

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
  { letterCount: 5, wordLengths: [3, 3, 3, 4, 4, 5] },
  { letterCount: 6, wordLengths: [3, 4, 5, 6, 6, 6] },
  { letterCount: 5, wordLengths: [3, 4, 4, 5] },
];

const circleRect = (c: Circle): Rect => ({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });

function inPlayArea(rect: Rect, layout: Layout): boolean {
  return (
    rect.x >= SAFE_ZONE_WIDTH &&
    rect.x + rect.w <= layout.width - SAFE_ZONE_WIDTH &&
    rect.y >= 0 &&
    rect.y + rect.h <= layout.height
  );
}

describe.each(SCREENS)('layout on a %i×%i screen', (width, height) => {
  describe.each(PUZZLE_SHAPES)('with $letterCount letters and words $wordLengths', (shape) => {
    const layout = computeLayout({ width, height, ...shape });

    it('keeps everything out of the safe zones and on screen', () => {
      const rects = [
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

    it('keeps the left column clear of the right column', () => {
      const rightColumnStart = Math.min(layout.extras.x, layout.bar.x, layout.backing.x - layout.backing.r);
      for (const rect of [...layout.rows, layout.shuffleButton, layout.hintButton]) {
        expect(rect.x + rect.w).toBeLessThanOrEqual(rightColumnStart);
      }
    });

    it('makes buttons at least 90 px tall', () => {
      expect(layout.shuffleButton.h).toBeGreaterThanOrEqual(90);
      expect(layout.hintButton.h).toBeGreaterThanOrEqual(90);
    });
  });
});
