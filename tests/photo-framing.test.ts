import { describe, expect, it } from 'vitest';
import { MAX_CAPTION, cleanCaption, dragFrame, fitLongSide, maxZoom, newPhotoId, pinchFrame } from '../src/photos/framing';

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

describe('zooming in', () => {
  it('goes up to 3×, but never so far that the framed part is under 800 px wide', () => {
    expect(maxZoom(4032, 3024)).toBe(3);
    expect(maxZoom(2000, 1500)).toBe(2.5);
    expect(maxZoom(1024, 768)).toBeCloseTo(1.28);
    expect(maxZoom(800, 600)).toBe(1);
    // A tall photo: the frame is as wide as the photo.
    expect(maxZoom(1512, 2016)).toBeCloseTo(1.89);
  });

  it('keeps its zoom when the photo is dragged', () => {
    expect(dragFrame({ x: 0.5, y: 0.5, zoom: 2 }, 2000, 1500, 1, 10, 0).zoom).toBe(2);
  });
});

describe('pinching the photo', () => {
  // A 2000 × 1500 photo shown in an 800 × 600 frame at (0, 0): at zoom 1 the whole photo fills it, at 0.4 px per photo px.
  const frame = { x: 0, y: 0, w: 800, h: 600 };
  const whole = { x: 0.5, y: 0.5, zoom: 1 };

  it('zooms in as the fingers spread, keeping the photo under them', () => {
    // Fingers 100 px apart around the middle spread to 200 px: twice as close, still centered.
    const at = pinchFrame(whole, 2000, 1500, frame, { x: 400, y: 300 }, 100, { x: 400, y: 300 }, 200, 3);
    expect(at.zoom).toBeCloseTo(2);
    expect(at.x).toBeCloseTo(0.5);
    expect(at.y).toBeCloseTo(0.5);
  });

  it('keeps the spot under the fingers under them when zooming toward a corner', () => {
    // Pinching out over the top-left corner keeps the frame at the top left.
    const at = pinchFrame(whole, 2000, 1500, frame, { x: 0, y: 0 }, 100, { x: 0, y: 0 }, 150, 3);
    expect(at.zoom).toBeCloseTo(1.5);
    expect(at.x).toBeCloseTo(0);
    expect(at.y).toBeCloseTo(0);
  });

  it('moves the photo with the fingers as well', () => {
    // At zoom 2, moving both fingers 80 px left moves the frame 80 / (800 / 1000) = 100 photo px right of 500, out of 1000 spare.
    const zoomed = { x: 0.5, y: 0.5, zoom: 2 };
    const at = pinchFrame(zoomed, 2000, 1500, frame, { x: 400, y: 300 }, 100, { x: 320, y: 300 }, 100, 3);
    expect(at.zoom).toBeCloseTo(2);
    expect(at.x).toBeCloseTo(0.6);
  });

  it('stops at the whole photo and at the most zoom', () => {
    expect(pinchFrame(whole, 2000, 1500, frame, { x: 400, y: 300 }, 200, { x: 400, y: 300 }, 50, 3).zoom).toBe(1);
    expect(pinchFrame(whole, 2000, 1500, frame, { x: 400, y: 300 }, 50, { x: 400, y: 300 }, 1000, 2.5).zoom).toBe(2.5);
  });

  it('ignores fingers that started in the same place', () => {
    expect(pinchFrame(whole, 2000, 1500, frame, { x: 400, y: 300 }, 0, { x: 400, y: 300 }, 100, 3)).toEqual(whole);
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
