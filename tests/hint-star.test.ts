import { afterEach, describe, expect, it, vi } from 'vitest';
import { flyHintStar, sparkOffsets, starPath, starPathD } from '../src/ui/hint-star';

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });
const HINT = box(0, 0, 130, 96);

describe('the hint star path', () => {
  it('starts at the center of Hint and ends at the center of the square', () => {
    const path = starPath(HINT, box(400, 300, 100, 100));
    expect(path.start).toEqual({ x: 65, y: 48 });
    expect(path.end).toEqual({ x: 450, y: 350 });
  });

  it('bends halfway across, 80 px above the higher end', () => {
    expect(starPath(box(0, 200, 130, 96), box(400, 300, 100, 100)).control).toEqual({ x: 257.5, y: 168 });
  });

  it('never bends above the top of the screen', () => {
    expect(starPath(HINT, box(400, 300, 100, 100)).control.y).toBe(0);
  });

  it('is written as a CSS path', () => {
    expect(starPathD(starPath(HINT, box(400, 300, 100, 100)))).toBe('M 65 48 Q 257.5 0 450 350');
  });
});

describe('the sparkle burst', () => {
  it('sends 10 sparkles evenly around a circle, 60 px out', () => {
    const offsets = sparkOffsets();
    expect(offsets).toHaveLength(10);
    expect(offsets[0].x).toBeCloseTo(60);
    expect(offsets[0].y).toBeCloseTo(0);
    for (const { x, y } of offsets) expect(Math.hypot(x, y)).toBeCloseTo(60);
  });
});

describe('Reduce Motion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('skips the star and resolves at once', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    // No DOM in these tests: touching the elements would throw, so resolving proves nothing was drawn.
    await expect(flyHintStar({} as HTMLElement, {} as HTMLElement)).resolves.toBeUndefined();
  });
});
