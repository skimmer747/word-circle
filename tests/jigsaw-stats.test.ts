import { describe, expect, it } from 'vitest';
import { puzzleEvent } from '../src/analytics';
import { familyStats } from '../src/stats/family-stats';
import { herStats, type HerStatsInput, type StatsGame } from '../src/stats/her-stats';
import { LOG_KEY, addPlay, emptyLifetime, loadLog } from '../src/stats/log';
import { jigsawRecord } from '../src/stats/records';
import { COUNT_LABELS, COUNT_LEVELS, PIECE_COUNTS } from '../src/jigsaw/types';
import { MemoryStore } from './memory-store';

const NOW = new Date(2026, 9, 28, 10, 30);
const record = jigsawRecord({ count: 16, style: 'board', hints: 2, ms: 95_000.4, now: NOW });

describe("Jigsaw's piece counts as levels", () => {
  it('labels 9, 16 and 30 pieces Easy, Medium and Hard, the levels they count as', () => {
    expect(PIECE_COUNTS.map((count) => COUNT_LABELS[count])).toEqual(['Easy', 'Medium', 'Hard']);
    expect(PIECE_COUNTS.map((count) => COUNT_LEVELS[count])).toEqual(['easy', 'medium', 'hard']);
  });
});

describe('Jigsaw in the play log', () => {
  it('logs a finished jigsaw with its piece count as a level, and its style', () => {
    expect(record).toEqual({
      day: '2026-10-28',
      hour: 10,
      game: 'jigsaw',
      level: 'medium',
      ms: 95_000,
      hints: 2,
      tries: 0,
      typed: true,
      daily: false,
      words: 0,
      letters: 0,
      longest: '',
      first: '',
      style: 'board',
    });
  });

  it('keeps the style through saving, and drops a record with a style it doesn\'t know', () => {
    const store = new MemoryStore();
    addPlay(store, record);
    expect(loadLog(store)).toEqual([record]);
    store.setItem(LOG_KEY, JSON.stringify([{ ...record, style: 'sideways' }]));
    expect(loadLog(store)).toEqual([]);
  });

  it('tells Google the style too, and nothing more', () => {
    expect(puzzleEvent(record)).toEqual({ game: 'jigsaw', level: 'medium', used_hint: 'yes', style: 'board' });
  });
});

describe('Jigsaw in her stats', () => {
  const games: StatsGame[] = [
    { id: 'circle', title: 'Word Circle', solved: 30 },
    { id: 'guess', title: 'Word Guess', solved: 10 },
    { id: 'grid', title: 'Word Grid', solved: 5 },
    { id: 'jigsaw', title: 'Jigsaw', solved: 40 },
  ];
  const input = (o: Partial<HerStatsInput> = {}): HerStatsInput => ({
    games,
    streak: { streakDays: 3, lastPlayedDay: '2026-10-28' },
    log: [],
    lifetime: emptyLifetime(),
    today: '2026-10-28',
    seen: null,
    ...o,
  });

  it('puts four games on the podium, the favorite second from the left with the crown', () => {
    expect(herStats(input()).podium.entries.map((e) => [e.id, e.top])).toEqual([
      ['circle', false],
      ['jigsaw', true],
      ['guess', false],
      ['grid', false],
    ]);
  });

  it('names her usual piece count', () => {
    const log = [record, record, jigsawRecord({ count: 9, style: 'tray', hints: 0, ms: 1_000, now: NOW })];
    expect(herStats(input({ log })).podium.note).toBe('Mostly 16 pieces');
  });
});

describe('Jigsaw in the family charts', () => {
  it('names the piece count in the table', () => {
    const before = { ...record, day: '2026-09-28', ms: 120_000 };
    expect(familyStats([before, record], '2026-10-28', '2026-08-01').table[0]).toEqual({
      label: 'Jigsaw, 16 pieces: time per puzzle',
      last: '1 min 35 sec',
      before: '2 min',
    });
  });
});
