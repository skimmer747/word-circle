import { describe, expect, it } from 'vitest';
import { keepAt, parseCaptions, slug, starterOrder, uniqueIds } from '../scripts/jigsaw-lib';
import { START_CROP, cropRect } from '../src/jigsaw/crop';

describe('framing a photo for a puzzle', () => {
  it('keeps the whole of a 4:3 photo', () => {
    expect(cropRect(1600, 1200)).toEqual({ x: 0, y: 0, w: 1600, h: 1200 });
  });

  it('frames a portrait photo near the top, where faces usually are', () => {
    expect(cropRect(3024, 4032)).toEqual({ x: 0, y: 441, w: 3024, h: 2268 });
  });

  it('centers a wide photo across', () => {
    expect(cropRect(4000, 1500)).toEqual({ x: 1000, y: 0, w: 2000, h: 1500 });
  });

  it('moves the frame anywhere inside the photo, never outside', () => {
    expect(cropRect(3024, 4032, { x: 0.5, y: 1 })).toMatchObject({ y: 1764 });
    expect(cropRect(3024, 4032, { x: 0.5, y: -3 })).toMatchObject({ y: 0 });
    expect(cropRect(3024, 4032, { x: 0.5, y: 7 })).toMatchObject({ y: 1764 });
  });

  it('zooms in by making the frame smaller, still 4:3 and inside the photo', () => {
    expect(cropRect(2000, 1500, { x: 0.5, y: 0.25, zoom: 2 })).toEqual({ x: 500, y: 188, w: 1000, h: 750 });
    expect(cropRect(2000, 1500, { x: 0, y: 1, zoom: 4 })).toEqual({ x: 0, y: 1125, w: 500, h: 375 });
  });

  it('never zooms out past the whole photo', () => {
    expect(cropRect(1600, 1200, { x: 0.5, y: 0.5, zoom: 0.5 })).toEqual({ x: 0, y: 0, w: 1600, h: 1200 });
    expect(cropRect(1600, 1200, { x: 0.5, y: 0.5, zoom: NaN })).toEqual({ x: 0, y: 0, w: 1600, h: 1200 });
  });

  it('never leaves the photo sideways either', () => {
    expect(cropRect(4000, 1500, { x: -2, y: 0.5 }).x).toBe(0);
    expect(cropRect(4000, 1500, { x: 5, y: 0.5 }).x).toBe(2000);
  });

  it('is always exactly 4:3, whole pixels, inside the photo and as big as it can be', () => {
    const sizes = [...Array.from({ length: 80 }, (_, i) => i + 1), 1600, 1200, 3024, 4032, 4000, 1500];
    const spots = [-1, 0, 0.25, 0.5, 1, 2, NaN];
    const failures: string[] = [];
    for (const width of sizes) {
      for (const height of sizes) {
        for (const x of spots) {
          for (const y of spots) {
            const r = cropRect(width, height, { x, y });
            const ok =
              [r.x, r.y, r.w, r.h].every((n) => Number.isInteger(n)) &&
              r.w * 3 === r.h * 4 &&
              r.x >= 0 &&
              r.y >= 0 &&
              r.x + r.w <= width &&
              r.y + r.h <= height &&
              (r.w + 4 > width || r.h + 3 > height);
            if (!ok) failures.push(`${width}x${height} at ${x},${y} gave ${JSON.stringify(r)}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('the starter pictures list', () => {
  it('reads "file | caption | keep" lines, skipping blank lines and # notes', () => {
    const notes = parseCaptions(
      '# Starter pictures\nlake.jpg | Lake Louise, Canada\n\nbarn.HEIC | Red barn in autumn | bottom\nkids.jpg | | top left\n',
    );
    expect([...notes.keys()]).toEqual(['lake.jpg', 'barn.HEIC', 'kids.jpg']);
    expect(notes.get('lake.jpg')).toEqual({ caption: 'Lake Louise, Canada', keep: START_CROP });
    expect(notes.get('barn.HEIC')).toEqual({ caption: 'Red barn in autumn', keep: { x: 0.5, y: 1 } });
    expect(notes.get('kids.jpg')).toEqual({ caption: '', keep: { x: 0, y: 0 } });
  });

  it('understands which part to keep', () => {
    expect(keepAt('')).toEqual(START_CROP);
    expect(keepAt('middle')).toEqual({ x: 0.5, y: 0.5 });
    expect(keepAt('right, bottom')).toEqual({ x: 1, y: 1 });
    expect(keepAt('Center Top')).toEqual({ x: 0.5, y: 0 });
  });

  it('names each picture from its file', () => {
    expect(slug('Lake Louise.JPG')).toBe('lake-louise');
    expect(slug("Mom's 90th (1).heic")).toBe('moms-90th-1');
    expect(slug('###.jpg')).toBe('picture');
    expect(uniqueIds(['Lake.jpg', 'lake.png', 'barn.jpg'])).toEqual(['lake', 'lake-2', 'barn']);
  });

  it("puts the listed pictures first, in the list's order, then the rest by name", () => {
    expect(starterOrder(['b.jpg', 'c.jpg', 'a.jpg', 'd.png'], ['c.jpg', 'a.jpg', 'gone.jpg'])).toEqual(['c.jpg', 'a.jpg', 'b.jpg', 'd.png']);
  });

  it('keeps a caption that has a | in it, when the keep words come last', () => {
    const notes = parseCaptions('a.jpg | Rose | Al, Lake George | bottom');
    expect(notes.get('a.jpg')).toEqual({ caption: 'Rose | Al, Lake George', keep: { x: 0.5, y: 1 } });
  });

  it('reads keep words joined by a dash', () => {
    expect(keepAt('top-left')).toEqual({ x: 0, y: 0 });
  });

  it('drops accents from ids, precomposed or decomposed', () => {
    expect(slug('Café.jpg')).toBe('cafe');
    expect(slug('Café.jpg')).toBe('cafe');
  });

  it('keeps ids unique even when a file name already looks numbered', () => {
    expect(uniqueIds(['lake.jpg', 'lake-2.jpg', 'lake.png'])).toEqual(['lake', 'lake-2', 'lake-3']);
  });

  it('sorts the rest by number, and lists a picture only once', () => {
    expect(starterOrder(['a10.jpg', 'a2.jpg'], [])).toEqual(['a2.jpg', 'a10.jpg']);
    expect(starterOrder(['a.jpg', 'b.jpg'], ['b.jpg', 'b.jpg'])).toEqual(['b.jpg', 'a.jpg']);
  });
});
