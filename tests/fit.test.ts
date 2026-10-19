import { describe, expect, it } from 'vitest';
import { fitFontScale } from '../src/ui/fit';

describe('fitFontScale', () => {
  it('keeps text full size when it fits', () => {
    expect(fitFontScale(500, 900)).toBe(1);
    expect(fitFontScale(900, 900)).toBe(1);
  });

  it('shrinks text just enough to fit on one line', () => {
    expect(fitFontScale(1000, 900)).toBeCloseTo(0.9, 5);
  });

  it('never shrinks below the minimum', () => {
    expect(fitFontScale(3000, 900)).toBe(0.6);
    expect(fitFontScale(3000, 900, 0.75)).toBe(0.75);
  });

  it('leaves text alone before it has been measured', () => {
    expect(fitFontScale(0, 900)).toBe(1);
    expect(fitFontScale(500, 0)).toBe(1);
  });
});
