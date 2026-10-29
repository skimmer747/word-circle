import { describe, expect, it } from 'vitest';
import { computeFrameLayout } from '../src/frame/layout';
import { computeGridLayout, trayTiles } from '../src/grid/layout';
import { SCREENS_AND_THUMBS, inPlayArea, overlaps } from './screens';

const SIZES = [4, 5, 6];

describe.each(SCREENS_AND_THUMBS)('Word Grid layout on a %i×%i screen, thumb %s', (width, height, thumb) => {
  const frame = computeFrameLayout(width, height, 3, thumb);

  describe.each(SIZES)('with a %i-square box', (size) => {
    const layout = computeGridLayout(frame, size);
    const tiles = trayTiles(layout, 4);
    const left = [...layout.levels, layout.hintButton];
    const box = {
      x: layout.squares[0].x,
      y: layout.squares[0].y,
      w: size * layout.squareSize,
      h: size * layout.squareSize,
    };

    it('puts Next over the empty tray when she looks back, clear of the grid and big enough to tap', () => {
      const next = layout.reviewButton;
      expect(inPlayArea(next, frame)).toBe(true);
      expect(next.w).toBeGreaterThanOrEqual(300);
      expect(next.h).toBeGreaterThanOrEqual(96);
      for (const rect of [box, frame.corner, layout.hintButton]) expect(overlaps(next, rect)).toBe(false);
    });

    it('keeps everything out of the safe zones and on screen', () => {
      for (const rect of [...left, layout.tray, ...tiles, ...layout.squares]) {
        expect(inPlayArea(rect, frame), JSON.stringify(rect)).toBe(true);
      }
    });

    it('puts Hint and Easy, Medium, Hard in the same places as every game', () => {
      expect(layout.hintButton).toEqual(frame.hintButton);
      expect(layout.levels).toEqual(frame.levelButtons);
    });

    it('fits four big tray tiles in the tray, clear of the left column and the top-right buttons', () => {
      expect(layout.tileSize).toBeGreaterThanOrEqual(84);
      for (const tile of tiles) {
        expect(tile.x).toBeGreaterThanOrEqual(layout.tray.x);
        expect(tile.x + tile.w).toBeLessThanOrEqual(layout.tray.x + layout.tray.w);
        expect(tile.y + tile.h).toBeLessThanOrEqual(layout.tray.y + layout.tray.h);
      }
      tiles.forEach((a, i) => tiles.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
      for (const rect of [...left, frame.corner]) expect(overlaps(layout.tray, rect), JSON.stringify(rect)).toBe(false);
    });

    it('makes squares at least 85 px (at most 150) between the tray and the level buttons, clear of everything else', () => {
      expect(layout.squareSize).toBeGreaterThanOrEqual(85);
      expect(layout.squareSize).toBeLessThanOrEqual(150);
      expect(layout.squares).toHaveLength(size * size);
      expect(box.y).toBeGreaterThanOrEqual(layout.tray.y + layout.tray.h + 16);
      expect(box.y + box.h).toBeLessThanOrEqual(layout.levels[0].y - 16);
      for (const rect of [...left, layout.tray, frame.corner]) expect(overlaps(box, rect), JSON.stringify(rect)).toBe(false);
    });

    it('sizes the letters to the squares and tiles', () => {
      expect(layout.squareFont).toBe(Math.round(layout.squareSize * 0.62));
      expect(layout.tileFont).toBe(Math.round(layout.tileSize * 0.62));
      expect(layout.cornerFont).toBeGreaterThanOrEqual(24);
    });
  });
});
