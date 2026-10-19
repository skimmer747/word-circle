import { describe, expect, it } from 'vitest';
import { dayKey, emptyStats, formatDuration, previousDay, recordSolve, type Stats } from '../src/game/stats';

const solve = (stats: Stats, day: string, ms = 120_000, level: 'easy' | 'medium' | 'hard' = 'medium') =>
  recordSolve(stats, level, ms, day);

describe('days in a row', () => {
  it('starts at one on the first day', () => {
    expect(solve(emptyStats(), '2026-10-19').celebration.streakDays).toBe(1);
  });

  it('stays the same for more puzzles on the same day', () => {
    const first = solve(emptyStats(), '2026-10-19').stats;
    expect(solve(first, '2026-10-19').celebration.streakDays).toBe(1);
  });

  it('grows by one on the next day', () => {
    let stats = solve(emptyStats(), '2026-10-19').stats;
    stats = solve(stats, '2026-10-20').stats;
    expect(solve(stats, '2026-10-21').celebration.streakDays).toBe(3);
  });

  it('quietly starts over after a missed day', () => {
    let stats = solve(emptyStats(), '2026-10-19').stats;
    stats = solve(stats, '2026-10-20').stats;
    expect(solve(stats, '2026-10-22').celebration.streakDays).toBe(1);
  });

  it('carries across month and year ends', () => {
    let stats = solve(emptyStats(), '2026-12-31').stats;
    stats = solve(stats, '2027-01-01').stats;
    expect(stats.streakDays).toBe(2);
    expect(previousDay('2027-03-01')).toBe('2027-02-28');
    expect(previousDay('2028-03-01')).toBe('2028-02-29');
  });
});

describe('puzzles today', () => {
  it('counts puzzles solved today and starts over on a new day', () => {
    let stats = solve(emptyStats(), '2026-10-19').stats;
    const second = solve(stats, '2026-10-19');
    expect(second.celebration.todaySolved).toBe(2);
    stats = second.stats;
    expect(solve(stats, '2026-10-20').celebration.todaySolved).toBe(1);
  });
});

describe('record times', () => {
  it('counts her first puzzle in a level as a record', () => {
    expect(solve(emptyStats(), '2026-10-19', 90_000).celebration.recordMs).toBe(90_000);
  });

  it('celebrates only when she beats her best for that level', () => {
    let stats = solve(emptyStats(), '2026-10-19', 90_000).stats;
    const slower = solve(stats, '2026-10-19', 100_000);
    expect(slower.celebration.recordMs).toBeNull();
    stats = slower.stats;
    const faster = solve(stats, '2026-10-19', 80_000);
    expect(faster.celebration.recordMs).toBe(80_000);
    expect(faster.stats.bestMs.medium).toBe(80_000);
  });

  it('keeps a separate best for each level', () => {
    const stats = solve(emptyStats(), '2026-10-19', 30_000, 'easy').stats;
    expect(solve(stats, '2026-10-19', 200_000, 'hard').celebration.recordMs).toBe(200_000);
  });
});

describe('total and milestones', () => {
  it('numbers each puzzle and marks milestones', () => {
    let stats = emptyStats();
    const milestones: number[] = [];
    for (let i = 1; i <= 101; i++) {
      const result = solve(stats, '2026-10-19');
      expect(result.celebration.puzzleNumber).toBe(i);
      if (result.celebration.milestone) milestones.push(i);
      stats = result.stats;
    }
    expect(milestones).toEqual([10, 25, 50, 100]);
  });

  it('keeps marking milestones past a thousand', () => {
    const stats: Stats = { ...emptyStats(), totalSolved: 1499 };
    expect(solve(stats, '2026-10-19').celebration.milestone).toBe(true);
  });
});

describe('formatDuration', () => {
  it('says times the way people do', () => {
    expect(formatDuration(45_000)).toBe('45 sec');
    expect(formatDuration(60_000)).toBe('1 min');
    expect(formatDuration(112_400)).toBe('1 min 52 sec');
    expect(formatDuration(3_780_000)).toBe('1 hr 3 min');
    expect(formatDuration(400)).toBe('1 sec');
  });
});

describe('dayKey', () => {
  it('uses the local calendar date', () => {
    expect(dayKey(new Date(2026, 9, 19, 23, 59))).toBe('2026-10-19');
    expect(dayKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});
