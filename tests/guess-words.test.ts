import { describe, expect, it } from 'vitest';
import { acceptedChecker } from '../src/guess/words';

describe('accepted guesses', () => {
  it('accepts only words on the accepted list', () => {
    const accepted = acceptedChecker({ answers: ['crane'], accepted: ['cares', 'crane'] });
    expect(accepted('cares')).toBe(true);
    expect(accepted('crane')).toBe(true);
    expect(accepted('xxxxx')).toBe(false);
  });
});
