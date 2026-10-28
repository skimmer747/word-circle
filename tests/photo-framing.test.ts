import { describe, expect, it } from 'vitest';
import { MAX_CAPTION, cleanCaption, dragFrame, fitLongSide, newPhotoId } from '../src/photos/framing';

describe('the size a family photo is kept at', () => {
  it('shrinks the long side to 2000 px, keeping the shape', () => {
    expect(fitLongSide(4032, 3024)).toEqual({ w: 2000, h: 1500 });
    expect(fitLongSide(3024, 4032)).toEqual({ w: 1500, h: 2000 });
  });

  it('never makes a small photo bigger', () => {
    expect(fitLongSide(800, 600)).toEqual({ w: 800, h: 600 });
  });
});

describe('dragging the photo under the frame', () => {
  // 2000 × 1000: the frame is 1332 × 999, with 668 px spare across and 1 px down.
  it('moves the frame the other way across the photo', () => {
    const at = dragFrame({ x: 0.5, y: 0.25 }, 2000, 1000, 0.5, 100, 0);
    expect(at.x).toBeCloseTo(0.5 - 200 / 668);
    expect(at.y).toBe(0.25);
  });

  it('keeps the frame inside the photo', () => {
    expect(dragFrame({ x: 0.5, y: 0.25 }, 2000, 1000, 0.5, 5000, 0).x).toBe(0);
    expect(dragFrame({ x: 0.5, y: 0.25 }, 2000, 1000, 0.5, -5000, 0).x).toBe(1);
  });

  it('only moves up and down in a tall photo', () => {
    // 1500 × 2000: the frame is 1500 × 1125, with 875 px spare down and none across.
    const at = dragFrame({ x: 0.5, y: 0.25 }, 1500, 2000, 1, 40, -100);
    expect(at.x).toBe(0.5);
    expect(at.y).toBeCloseTo(0.25 + 100 / 875);
  });
});

describe('a caption as saved', () => {
  it('keeps at most two lines, each trimmed', () => {
    expect(cleanCaption('  Rose and Al,\n\n  Lake George,   1987  \nextra')).toBe('Rose and Al,\nLake George, 1987');
  });

  it('is at most 80 characters', () => {
    expect(cleanCaption('a'.repeat(100))).toHaveLength(MAX_CAPTION);
  });

  it('is empty when nothing was typed', () => {
    expect(cleanCaption(' \n ')).toBe('');
  });
});

describe('a new photo id', () => {
  it('is letters and digits only', () => {
    expect(newPhotoId(1_793_000_000_000, () => 0.5)).toMatch(/^[a-z0-9]+$/);
  });

  it('differs for photos added in the same moment', () => {
    expect(newPhotoId(5, () => 0.1)).not.toBe(newPhotoId(5, () => 0.2));
  });
});
