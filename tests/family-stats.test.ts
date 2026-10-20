import { describe, expect, it } from 'vitest';
import { familyStats, niceMax, shortDay } from '../src/stats/family-stats';
import type { PlayRecord } from '../src/stats/log';

const TODAY = '2026-10-20';
const rec = (o: Partial<PlayRecord> = {}): PlayRecord => ({
  day: TODAY,
  hour: 9,
  game: 'circle',
  level: 'medium',
  ms: 60_000,
  hints: 0,
  tries: 0,
  typed: true,
  daily: false,
  words: 5,
  letters: 20,
  longest: 'stone',
  first: '',
  ...o,
});

describe('when the charts are ready', () => {
  it('waits for 14 days of log', () => {
    expect(familyStats([], TODAY, null).ready).toBe(false);
    expect(familyStats([], TODAY, '2026-10-08').ready).toBe(false);
    expect(familyStats([], TODAY, '2026-10-07').ready).toBe(true);
  });
});

describe('the weekly charts', () => {
  it('splits the last 12 weeks into 7-day buckets ending today', () => {
    const { weekStarts } = familyStats([], TODAY, '2026-01-01');
    expect(weekStarts).toHaveLength(12);
    expect(weekStarts[11]).toBe('2026-10-14');
    expect(weekStarts[0]).toBe('2026-07-29');
  });

  it("averages speed at each game's most-played level, with gaps for weeks without play", () => {
    const log = [rec({ ms: 60_000 }), rec({ ms: 120_000 }), rec({ level: 'easy', ms: 10_000 })];
    const { speed } = familyStats(log, TODAY, '2026-01-01');
    expect(speed).toEqual([{ game: 'circle', label: 'Circle', points: [...new Array(11).fill(null), 1.5] }]);
  });

  it('averages hints and Word Guess tries', () => {
    const log = [rec({ hints: 1 }), rec({ hints: 3 }), rec({ game: 'guess', level: null, tries: 3 }), rec({ game: 'guess', level: null, tries: 5 }), rec({ game: 'guess', level: null, tries: 0 })];
    const stats = familyStats(log, TODAY, '2026-01-01');
    expect(stats.hints.map((s) => [s.game, s.points[11]])).toEqual([['circle', 2]]);
    expect(stats.tries?.points[11]).toBe(4);
  });

  it('counts puzzles per day and per week, by game', () => {
    const log = [rec(), rec(), rec({ day: '2026-10-19', game: 'grid', level: 'easy' })];
    const stats = familyStats(log, TODAY, '2026-01-01');
    expect(stats.perDay).toHaveLength(28);
    expect(stats.perDay.slice(26)).toEqual([1, 2]);
    expect(stats.days[27]).toBe(TODAY);
    expect(stats.games.map((g) => [g.game, g.label, g.counts[11]])).toEqual([
      ['circle', 'Word Circle', 2],
      ['grid', 'Word Grid', 1],
    ]);
  });

  it('shares out the time of day', () => {
    const log = [rec({ hour: 9 }), rec({ hour: 10 }), rec({ hour: 11 }), rec({ hour: 13 })];
    expect(familyStats(log, TODAY, '2026-01-01').timeOfDay).toEqual([
      { label: 'Morning', share: 75 },
      { label: 'Afternoon', share: 25 },
      { label: 'Evening', share: 0 },
      { label: 'Night', share: 0 },
    ]);
  });
});

describe('the table', () => {
  it('sets the last 4 weeks beside the 4 before', () => {
    const log = [rec({ day: '2026-09-20', ms: 90_000, hints: 1 }), rec({ ms: 60_000, hints: 2 })];
    expect(familyStats(log, TODAY, '2026-08-01').table).toEqual([
      { label: 'Word Circle, Medium: time per puzzle', last: '1 min', before: '1 min 30 sec' },
      { label: 'Word Circle: hints per puzzle', last: '2.0', before: '1.0' },
      { label: 'Days played', last: '1 of 28', before: '1 of 28' },
    ]);
  });

  it('leaves out rows without both periods, and days played before the log began', () => {
    expect(familyStats([rec()], TODAY, '2026-10-01').table).toEqual([]);
  });
});

describe('helpers', () => {
  it('rounds an axis up to 1, 2 or 5 times a power of ten', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(0.8)).toBe(1);
    expect(niceMax(1.3)).toBe(2);
    expect(niceMax(3.1)).toBe(5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(42)).toBe(50);
  });

  it('writes a day as "Oct 5"', () => {
    expect(shortDay('2026-10-05')).toBe('Oct 5');
  });
});
