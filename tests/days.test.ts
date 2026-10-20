import { describe, expect, it } from 'vitest';
import { addDays, isMilestone, recordPlayDay } from '../src/shared/days';

describe('days in a row across both games', () => {
  it('starts at one on the first day', () => {
    expect(recordPlayDay({ streakDays: 0, lastPlayedDay: null }, '2026-10-19')).toEqual({ streakDays: 1, lastPlayedDay: '2026-10-19' });
  });

  it('stays the same for more puzzles or words on the same day', () => {
    expect(recordPlayDay({ streakDays: 3, lastPlayedDay: '2026-10-19' }, '2026-10-19')).toEqual({ streakDays: 3, lastPlayedDay: '2026-10-19' });
  });

  it('grows by one on the next day', () => {
    expect(recordPlayDay({ streakDays: 3, lastPlayedDay: '2026-10-19' }, '2026-10-20')).toEqual({ streakDays: 4, lastPlayedDay: '2026-10-20' });
  });

  it('quietly starts over after a missed day', () => {
    expect(recordPlayDay({ streakDays: 3, lastPlayedDay: '2026-10-19' }, '2026-10-21')).toEqual({ streakDays: 1, lastPlayedDay: '2026-10-21' });
  });

  it('carries across a year end', () => {
    expect(recordPlayDay({ streakDays: 9, lastPlayedDay: '2026-12-31' }, '2027-01-01').streakDays).toBe(10);
  });
});

describe('milestones', () => {
  it('celebrates 10, 25, 50, 100, 250, 500, 750 and 1,000, then every 500', () => {
    expect([10, 25, 50, 100, 250, 500, 750, 1000, 1500, 2000].every(isMilestone)).toBe(true);
    expect([1, 9, 11, 24, 99, 1001, 1250].some(isMilestone)).toBe(false);
  });
});

describe('addDays', () => {
  it('moves a day back and forward across months and years', () => {
    expect(addDays('2026-10-20', -1)).toBe('2026-10-19');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-20', 0)).toBe('2026-10-20');
  });

  it('moves a long way', () => {
    expect(addDays('2026-10-20', -400)).toBe('2025-09-15');
  });
});
