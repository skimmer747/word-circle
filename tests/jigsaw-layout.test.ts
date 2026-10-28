import { describe, expect, it } from 'vitest';
import { computeFrameLayout, type Rect } from '../src/frame/layout';
import { tabFor } from '../src/jigsaw/cut';
import { clampToFree, computeJigsawLayout, computePicturePageLayout, tablePieces } from '../src/jigsaw/layout';
import { GRID_SIZES, JIGSAW_STYLES, PIECE_COUNTS } from '../src/jigsaw/types';
import { SCREENS_AND_THUMBS, inPlayArea, overlaps } from './screens';

const inside = (a: Rect, b: Rect) => a.x >= b.x - 0.001 && a.y >= b.y - 0.001 && a.x + a.w <= b.x + b.w + 0.001 && a.y + a.h <= b.y + b.h + 0.001;
/** Fails with the index pairs that overlap, so a failure says which two. */
const apart = (rects: readonly Rect[]) => {
  const pairs: Array<[number, number]> = [];
  rects.forEach((a, i) => rects.forEach((b, j) => i < j && overlaps(a, b) && pairs.push([i, j])));
  expect(pairs).toEqual([]);
};

describe.each(SCREENS_AND_THUMBS)('Jigsaw on a %ix%i iPad (thumb %s)', (width, height, thumb) => {
  const frame = computeFrameLayout(width, height, 4, thumb);
  const layout = computeJigsawLayout(frame);
  const buttons = [layout.hintButton, layout.picturesButton, ...layout.styleButtons, ...layout.countButtons];

  it('puts Hint and the piece counts where every game has Hint and its levels', () => {
    expect(layout.hintButton).toEqual(frame.hintButton);
    expect(layout.countButtons).toEqual(frame.levelButtons);
    layout.styleButtons.forEach((rect, i) => expect(rect).toEqual({ ...frame.levelButtons[i], y: frame.levelButtons[i].y - 8 - rect.h }));
  });

  it('has Tray, Board and Table, and Pictures beside Hint', () => {
    expect(layout.styleButtons).toHaveLength(JIGSAW_STYLES.length);
    expect(layout.picturesButton.w).toBe(layout.hintButton.w);
    expect(layout.picturesButton.h).toBe(layout.hintButton.h);
    expect(layout.picturesButton.x).toBe(layout.hintButton.x + layout.hintButton.w + 16);
    expect(layout.picturesButton.y).toBe(layout.hintButton.y);
  });

  it('keeps everything in the play area, apart', () => {
    const parts = [...buttons, layout.tray, layout.board, frame.corner];
    for (const rect of [...parts, ...layout.free, layout.finished, layout.caption]) expect(inPlayArea(rect, frame)).toBe(true);
    apart(parts);
  });

  it('keeps the free area clear of the buttons, the tray and the corner', () => {
    for (const area of layout.free) for (const rect of [...buttons, layout.tray, frame.corner]) expect(overlaps(area, rect)).toBe(false);
    apart(layout.free);
    expect(inside(layout.board, layout.free[0])).toBe(true);
  });

  it('makes the board and the finished picture 4:3, with big pieces', () => {
    expect(layout.board.w / layout.board.h).toBeCloseTo(4 / 3);
    expect(layout.board.w / GRID_SIZES[30].cols).toBeGreaterThanOrEqual(95);
    expect(layout.finished.w / layout.finished.h).toBeCloseTo(4 / 3);
    apart([layout.finished, layout.caption, frame.corner]);
  });

  it('fits three tray places, the box lid and the review Next in the tray', () => {
    expect(layout.slots).toHaveLength(3);
    expect(layout.lid.w / layout.lid.h).toBeCloseTo(4 / 3);
    for (const rect of [...layout.slots, layout.lid, layout.reviewButton]) expect(inside(rect, layout.tray)).toBe(true);
    apart(layout.slots);
    expect(layout.slots[0].w).toBeGreaterThanOrEqual(60);
  });

  it.each(PIECE_COUNTS)('has room on the table for all %i pieces, apart, at least 70 px wide', (count) => {
    const table = tablePieces(layout, count);
    expect(table.w).toBeGreaterThanOrEqual(70);
    expect(table.w).toBeLessThanOrEqual(layout.board.w / GRID_SIZES[count].cols);
    expect(table.spots.length).toBeGreaterThanOrEqual(count);
    const tab = tabFor(table.w, table.h);
    const outers = table.spots.map((s) => ({ x: s.x - tab, y: s.y - tab, w: s.w + 2 * tab, h: s.h + 2 * tab }));
    for (const outer of outers) expect(layout.free.some((area) => inside(outer, area))).toBe(true);
    apart(outers);
  });

  it('makes table pieces smaller for more pieces, and measures each count once', () => {
    const [nine, sixteen, thirty] = PIECE_COUNTS.map((count) => tablePieces(layout, count).w);
    expect(nine).toBeGreaterThanOrEqual(sixteen);
    expect(sixteen).toBeGreaterThanOrEqual(thirty);
    expect(tablePieces(layout, 30)).toBe(tablePieces(layout, 30));
  });

  it('keeps a piece the size of a 9-piece one, tabs and all, in the free area', () => {
    const w = layout.board.w / 3;
    const h = layout.board.h / 3;
    const overhang = tabFor(w, h);
    const middle = layout.free[1];
    const body = clampToFree(layout.free, { x: middle.x + middle.w / 2 - w / 2, y: middle.y + middle.h / 2 - h / 2, w, h }, overhang);
    const outer = { x: body.x - overhang, y: body.y - overhang, w: w + 2 * overhang, h: h + 2 * overhang };
    expect(layout.free.some((area) => inside(outer, area))).toBe(true);
  });

  it('lays out the picture page clear of the corner', () => {
    const page = computePicturePageLayout(frame);
    const rects = [page.title, ...page.tiles, ...page.captions, page.back, page.close, page.more];
    for (const rect of rects) expect(inPlayArea(rect, frame)).toBe(true);
    apart([...rects, frame.corner]);
    expect(page.tiles).toHaveLength(6);
    expect(page.tiles[0].w / page.tiles[0].h).toBeCloseTo(4 / 3);
    expect(page.tiles[0].w).toBeGreaterThanOrEqual(200);
  });

  it('fits four cards in the Games pop-up', () => {
    apart(frame.gameCards);
    for (const card of frame.gameCards) expect(card.w).toBeGreaterThanOrEqual(150);
  });
});

describe('keeping loose pieces in the free area', () => {
  const free = [
    { x: 100, y: 100, w: 600, h: 400 },
    { x: 500, y: 520, w: 200, h: 100 },
  ];

  it("leaves a piece that's inside where it is", () => {
    expect(clampToFree(free, { x: 150, y: 150, w: 80, h: 60 })).toEqual({ x: 150, y: 150, w: 80, h: 60 });
  });

  it('nudges a piece back inside the part its middle is nearest', () => {
    expect(clampToFree(free, { x: 60, y: 90, w: 80, h: 60 })).toEqual({ x: 100, y: 100, w: 80, h: 60 });
    expect(clampToFree(free, { x: 640, y: 560, w: 80, h: 60 })).toEqual({ x: 620, y: 560, w: 80, h: 60 });
  });

  it('keeps the overhang (tabs) inside too', () => {
    expect(clampToFree(free, { x: 60, y: 150, w: 80, h: 60 }, 10)).toEqual({ x: 110, y: 150, w: 80, h: 60 });
  });

  it("puts a piece in a part it fits in, even if its middle is nearer one it doesn't", () => {
    const parts = [
      { x: 0, y: 0, w: 400, h: 400 },
      { x: 500, y: 0, w: 50, h: 50 },
    ];
    expect(clampToFree(parts, { x: 480, y: 10, w: 100, h: 100 })).toEqual({ x: 300, y: 10, w: 100, h: 100 });
  });

  it("doesn't throw for a piece bigger than every part: it lands at the nearest part's top left", () => {
    const small = [
      { x: 100, y: 100, w: 50, h: 50 },
      { x: 400, y: 100, w: 50, h: 50 },
    ];
    expect(clampToFree(small, { x: 380, y: 90, w: 200, h: 200 })).toEqual({ x: 400, y: 100, w: 200, h: 200 });
    expect(clampToFree(small, { x: 380, y: 90, w: 200, h: 200 }, 10)).toEqual({ x: 410, y: 110, w: 200, h: 200 });
  });
});
