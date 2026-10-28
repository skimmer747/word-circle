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
});
