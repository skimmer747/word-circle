import { describe, expect, it } from 'vitest';
import { computeFrameLayout } from '../src/frame/layout';
import { computeGridLayout, trayTiles } from '../src/grid/layout';
import { SCREENS, inPlayArea, overlaps } from './screens';

const SIZES = [4, 5, 6];

describe.each(SCREENS)('Word Grid layout on a %i×%i screen', (width, height) => {
  const frame = computeFrameLayout(width, height, 3);

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

    it('keeps everything out of the safe zones and on screen', () => {
      for (const rect of [...left, layout.tray, ...tiles, ...layout.squares]) {
        expect(inPlayArea(rect, frame), JSON.stringify(rect)).toBe(true);
      }
    });

    it('stacks Easy, Medium, Hard and Hint in a left column at least 110 px wide', () => {
      left.forEach((rect, i) => {
        expect(rect.x).toBe(frame.play.x);
        expect(rect.w).toBeGreaterThanOrEqual(110);
        if (i > 0) expect(rect.y).toBeGreaterThanOrEqual(left[i - 1].y + left[i - 1].h);
      });
      for (const level of layout.levels) expect(level.h).toBeGreaterThanOrEqual(60);
      expect(layout.hintButton.h).toBeGreaterThanOrEqual(90);
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

    it('makes squares at least 90 px (at most 150) in a grid below the tray, clear of everything else', () => {
      expect(layout.squareSize).toBeGreaterThanOrEqual(90);
      expect(layout.squareSize).toBeLessThanOrEqual(150);
      expect(layout.squares).toHaveLength(size * size);
      expect(box.y).toBeGreaterThanOrEqual(layout.tray.y + layout.tray.h + 16);
      for (const rect of [...left, layout.tray, frame.corner]) expect(overlaps(box, rect), JSON.stringify(rect)).toBe(false);
    });

    it('sizes the letters to the squares and tiles', () => {
      expect(layout.squareFont).toBe(Math.round(layout.squareSize * 0.62));
      expect(layout.tileFont).toBe(Math.round(layout.tileSize * 0.62));
      expect(layout.cornerFont).toBeGreaterThanOrEqual(18);
    });
  });
});
