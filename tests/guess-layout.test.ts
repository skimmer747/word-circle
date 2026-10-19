import { describe, expect, it } from 'vitest';
import { computeFrameLayout } from '../src/frame/layout';
import { computeGuessLayout } from '../src/guess/layout';
import { SCREENS, inPlayArea, overlaps } from './screens';

describe.each(SCREENS)('Word Guess layout on a %i×%i screen', (width, height) => {
  const layout = computeGuessLayout(computeFrameLayout(width, height));
  const { frame, rows, keys } = layout;
  const left = [layout.hintButton, layout.allLettersButton, layout.dailyButton];
  const keyRects = keys.map((key) => key.rect);
  const key = (id: string) => keys.find((k) => k.id === id)!.rect;

  it('keeps everything out of the safe zones and on screen', () => {
    for (const rect of [...rows, ...keyRects, ...left]) expect(inPlayArea(rect, frame), JSON.stringify(rect)).toBe(true);
  });

  it("has the 26 letters plus Enter and Back, in Wordle's three rows", () => {
    expect(keys.map((k) => k.id.slice('key:'.length)).join(' ')).toBe(
      'q w e r t y u i o p a s d f g h j k l enter z x c v b n m back',
    );
  });

  it('makes keys big: at least 64 px tall and 60 px wide, with Enter and Back one and a half keys wide', () => {
    expect(key('key:q').h).toBeGreaterThanOrEqual(64);
    expect(key('key:q').w).toBeGreaterThanOrEqual(60);
    expect(key('key:enter').w).toBeGreaterThan(key('key:q').w * 1.4);
    expect(key('key:back').w).toBeGreaterThan(key('key:q').w * 1.4);
  });

  it('spreads the keyboard across the bottom of the play area without overlaps', () => {
    const { play } = frame;
    expect(key('key:q').x).toBeCloseTo(play.x, 5);
    expect(key('key:p').x + key('key:p').w).toBeCloseTo(play.x + play.w, 5);
    expect(key('key:back').x + key('key:back').w).toBeCloseTo(play.x + play.w, 5);
    expect(key('key:m').y + key('key:m').h).toBeCloseTo(play.y + play.h, 5);
    keyRects.forEach((a, i) => keyRects.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
  });

  it('makes six rows of five squares between 70 and 110 px', () => {
    expect(rows).toHaveLength(6);
    expect(layout.squareSize).toBeGreaterThanOrEqual(70);
    expect(layout.squareSize).toBeLessThanOrEqual(110);
    for (const row of rows) {
      expect(row.w).toBeCloseTo(5 * layout.squareSize + 4 * layout.squareGap, 5);
      expect(row.h).toBe(layout.squareSize);
    }
  });

  it('keeps the board above the keyboard and clear of the left buttons and the top-right buttons', () => {
    const board = { x: rows[0].x, y: rows[0].y, w: rows[0].w, h: rows[5].y + rows[5].h - rows[0].y };
    for (const rect of [...keyRects, ...left, frame.corner]) expect(overlaps(board, rect), JSON.stringify(rect)).toBe(false);
    expect(board.y + board.h).toBeLessThanOrEqual(Math.min(...keyRects.map((r) => r.y)) - 16);
  });

  it('stacks Hint, All letters and the daily button in a left column at least 110 px wide', () => {
    for (const button of left) {
      expect(button.w).toBeGreaterThanOrEqual(110);
      expect(button.h).toBeGreaterThanOrEqual(90);
      expect(button.x).toBe(frame.play.x);
      for (const k of keyRects) expect(overlaps(button, k)).toBe(false);
    }
    expect(layout.allLettersButton.y).toBeGreaterThanOrEqual(layout.hintButton.y + layout.hintButton.h);
    expect(layout.dailyButton.y).toBeGreaterThanOrEqual(layout.allLettersButton.y + layout.allLettersButton.h);
  });
});
