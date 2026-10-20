import { describe, expect, it } from 'vitest';
import { computeLayout, type Circle, type Rect } from '../src/circle/layout';
import { computeFrameLayout } from '../src/frame/layout';
import { SCREENS_AND_THUMBS, inPlayArea, overlaps } from './screens';

const PUZZLE_SHAPES = [
  { letterCount: 4, wordLengths: [3, 3, 4, 4] },
  { letterCount: 5, wordLengths: [3, 3, 3, 4, 4, 5] },
  { letterCount: 6, wordLengths: [3, 4, 5, 6, 6, 6] },
  { letterCount: 5, wordLengths: [3, 4, 4, 5] },
];

const circleRect = (c: Circle): Rect => ({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });

describe.each(SCREENS_AND_THUMBS)('Word Circle layout on a %i×%i screen, thumb %s', (width, height, thumb) => {
  describe.each(PUZZLE_SHAPES)('with $letterCount letters and words $wordLengths', (shape) => {
    const layout = computeLayout(computeFrameLayout(width, height, 3, thumb), shape);
    const { frame } = layout;

    it('puts Next over the letter circle when she looks back, clear of her words and big enough to tap', () => {
      const next = layout.reviewButton;
      expect(inPlayArea(next, frame)).toBe(true);
      expect(next.w).toBeGreaterThanOrEqual(300);
      expect(next.h).toBe(100);
      for (const row of layout.rows) expect(overlaps(next, row)).toBe(false);
      for (const rect of [frame.corner, layout.extras]) expect(overlaps(next, rect)).toBe(false);
    });

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
      for (const rect of rects) expect(inPlayArea(rect, frame), JSON.stringify(rect)).toBe(true);
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

    it('stacks word rows between Hint and Shuffle at the top and the level buttons at the bottom', () => {
      layout.rows.forEach((row, i) => {
        if (i > 0) expect(row.y).toBeGreaterThanOrEqual(layout.rows[i - 1].y + layout.rows[i - 1].h);
      });
      const last = layout.rows[layout.rows.length - 1];
      expect(layout.rows[0].y).toBeGreaterThanOrEqual(layout.hintButton.y + layout.hintButton.h + 16);
      expect(last.y + last.h).toBeLessThanOrEqual(layout.levels[0].y - 16);
    });

    it('puts Extra words at the top right, above the word bar and letter circle', () => {
      const { extras, bar, backing } = layout;
      expect(extras.h).toBeGreaterThanOrEqual(120);
      expect(extras.y + extras.h).toBeLessThanOrEqual(bar.y);
      expect(bar.y + bar.h).toBeLessThanOrEqual(backing.y - backing.r);
      expect(extras.x + extras.w).toBeGreaterThan(backing.x);
    });

    it('keeps Extra words and the word bar clear of the top-right buttons', () => {
      expect(layout.extras.x + layout.extras.w).toBeLessThanOrEqual(frame.corner.x);
      expect(frame.corner.y + frame.corner.h).toBeLessThanOrEqual(layout.bar.y);
    });

    it('leaves Extra words at least 200 px wide beside the Games and clock buttons', () => {
      expect(layout.extras.w).toBeGreaterThanOrEqual(200);
    });

    it('puts the level buttons in the same row at the bottom left as every game', () => {
      expect(layout.levels).toEqual(frame.levelButtons);
    });

    it('puts Hint in the same top-left place as every game, with Shuffle the same size beside it', () => {
      const { hintButton, shuffleButton } = layout;
      expect(hintButton).toEqual(frame.hintButton);
      expect(shuffleButton.y).toBe(hintButton.y);
      expect(shuffleButton.x).toBeGreaterThanOrEqual(hintButton.x + hintButton.w + 16);
      expect([shuffleButton.w, shuffleButton.h]).toEqual([hintButton.w, hintButton.h]);
    });

    it('keeps the left column clear of the right column', () => {
      const rightColumnStart = Math.min(layout.extras.x, layout.bar.x, layout.backing.x - layout.backing.r);
      for (const rect of [...layout.levels, ...layout.rows, layout.shuffleButton, layout.hintButton]) {
        expect(rect.x + rect.w).toBeLessThanOrEqual(rightColumnStart);
      }
    });

    it('makes buttons at least 90 px tall', () => {
      expect(layout.shuffleButton.h).toBeGreaterThanOrEqual(90);
      expect(layout.hintButton.h).toBeGreaterThanOrEqual(90);
    });
  });
});
