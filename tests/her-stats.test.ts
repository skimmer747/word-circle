import { describe, expect, it } from 'vitest';
import {
  SEEN_KEY,
  herStats,
  loadSeen,
  saveSeen,
  seenAfter,
  type HerStatsInput,
  type StatsGame,
} from '../src/stats/her-stats';
import { emptyLifetime, type Lifetime, type PlayRecord } from '../src/stats/log';
import { MemoryStore } from './memory-store';

const CIRCLE: StatsGame = { id: 'circle', title: 'Word Circle', solved: 734, bestMs: { easy: 38_000, medium: 72_000 } };
const GUESS: StatsGame = { id: 'guess', title: 'Word Guess', solved: 312 };
const GRID: StatsGame = { id: 'grid', title: 'Word Grid', solved: 202 };
const rec = (o: Partial<PlayRecord> = {}): PlayRecord => ({
  day: '2026-10-20',
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
const life = (o: Partial<Lifetime> = {}): Lifetime => ({ ...emptyLifetime(), ...o });
const input = (o: Partial<HerStatsInput> = {}): HerStatsInput => ({
  games: [CIRCLE, GUESS, GRID],
  streak: { streakDays: 12, lastPlayedDay: '2026-10-20' },
  log: [],
  lifetime: emptyLifetime(),
  today: '2026-10-20',
  seen: null,
  ...o,
});

describe('card 1: the total', () => {
  it('adds up the games and shows days in a row', () => {
    expect(herStats(input()).total).toEqual({
      value: 1248,
      label: 'puzzles and words',
      lines: [{ icon: 'sun', text: '12 days in a row', isNew: false }],
      isNew: false,
    });
  });

  it('shows days played from the log', () => {
    expect(herStats(input({ lifetime: life({ daysPlayed: 84 }) })).total.lines[1]).toEqual({ icon: 'calendar', text: '84 days played', isNew: false });
    expect(herStats(input({ lifetime: life({ daysPlayed: 1 }) })).total.lines[1].text).toBe('1 day played');
  });

  it('shows days in a row only from 2, and only while it lasts', () => {
    expect(herStats(input({ streak: { streakDays: 1, lastPlayedDay: '2026-10-20' } })).total.lines).toEqual([]);
    expect(herStats(input({ streak: { streakDays: 5, lastPlayedDay: '2026-10-18' } })).total.lines).toEqual([]);
    expect(herStats(input({ streak: { streakDays: 5, lastPlayedDay: '2026-10-19' } })).total.lines[0].text).toBe('5 days in a row');
  });

  it('names what she solves', () => {
    expect(herStats(input({ games: [GUESS] })).total.label).toBe('words');
    expect(herStats(input({ games: [CIRCLE, GRID] })).total.label).toBe('puzzles');
    expect(herStats(input({ games: [{ ...CIRCLE, solved: 1 }] })).total.label).toBe('puzzle');
  });

  it('is new when a milestone passed since her last look', () => {
    const seen = { total: 990, circleBest: {}, fewestTries: null, longestWord: '' };
    expect(herStats(input({ seen })).total.isNew).toBe(true);
    expect(herStats(input({ seen: { ...seen, total: 1248 } })).total.isNew).toBe(false);
    expect(herStats(input()).total.isNew).toBe(false);
  });
});

describe('card 2: the podium', () => {
  it('puts the most-played game in the middle with the crown', () => {
    const { entries } = herStats(input()).podium;
    expect(entries.map((e) => [e.id, e.top])).toEqual([
      ['guess', false],
      ['circle', true],
      ['grid', false],
    ]);
  });

  it('handles two games, one game, and no play yet', () => {
    expect(herStats(input({ games: [GUESS, CIRCLE] })).podium.entries.map((e) => e.id)).toEqual(['guess', 'circle']);
    expect(herStats(input({ games: [GRID] })).podium.entries.map((e) => e.id)).toEqual(['grid']);
    const fresh = [{ ...CIRCLE, solved: 0 }, { ...GUESS, solved: 0 }];
    expect(herStats(input({ games: fresh })).podium.entries.some((e) => e.top)).toBe(false);
  });

  it('names the level she plays most in her favorite game', () => {
    const log = [rec({ level: 'medium' }), rec({ level: 'medium' }), rec({ level: 'easy' })];
    expect(herStats(input({ log })).podium.note).toBe('Mostly on Medium');
    expect(herStats(input({ log: [] })).podium.note).toBeNull();
    expect(herStats(input({ games: [{ ...GUESS, solved: 999 }, CIRCLE], log })).podium.note).toBeNull();
  });
});

describe('card 3: bests', () => {
  it("lists Word Circle's fastest times", () => {
    expect(herStats(input()).bests.fastest).toEqual([
      { icon: 'trophy', text: 'Easy 38 sec', isNew: false },
      { icon: 'trophy', text: 'Medium 1 min 12 sec', isNew: false },
    ]);
  });

  it('marks a best that got faster since her last look', () => {
    const seen = { total: 1248, circleBest: { easy: 40_000, medium: 72_000 }, fewestTries: null, longestWord: '' };
    const { bests } = herStats(input({ seen }));
    expect(bests.fastest.map((l) => l.isNew)).toEqual([true, false]);
    expect(bests.isNew).toBe(true);
  });

  it('counts no-hint Word Grids', () => {
    expect(herStats(input({ lifetime: life({ noHintGrids: 57 }) })).bests.others).toContainEqual({ icon: 'target', text: '57 Word Grids, no hints', isNew: false });
    expect(herStats(input({ lifetime: life({ noHintGrids: 1 }) })).bests.others[0].text).toBe('1 Word Grid, no hints');
    expect(herStats(input({ games: [CIRCLE], lifetime: life({ noHintGrids: 5 }) })).bests.others).toEqual([]);
  });

  it('says "getting quicker" only when it is true', () => {
    const week = (day: string, ms: number) => [rec({ day, ms }), rec({ day, ms }), rec({ day, ms })];
    const quicker = [...week('2026-10-10', 90_000), ...week('2026-10-18', 60_000)];
    expect(herStats(input({ log: quicker })).bests.others).toContainEqual({ icon: 'rocket', text: 'Getting quicker at Medium!', isNew: false });
    const slower = [...week('2026-10-10', 60_000), ...week('2026-10-18', 90_000)];
    expect(herStats(input({ log: slower })).bests.others).toEqual([]);
    expect(herStats(input({ log: quicker.slice(1) })).bests.others).toEqual([]);
  });

  it('draws the Word Guess chart, or invites her to start it', () => {
    const { bests } = herStats(input({ lifetime: life({ triesCounts: [0, 14, 61, 122, 80, 28, 7] }) }));
    expect(bests.tries?.map((t) => [t.label, t.count, t.top])).toEqual([
      ['1', 0, false],
      ['2', 14, false],
      ['3', 61, false],
      ['4', 122, true],
      ['5', 80, false],
      ['6', 28, false],
      ['7+', 7, false],
    ]);
    expect(herStats(input()).bests).toMatchObject({ tries: null, triesNote: 'Your Word Guess chart starts with your next word.' });
    expect(herStats(input({ games: [CIRCLE] })).bests).toMatchObject({ tries: null, triesNote: null });
  });

  it('marks fewer tries than ever as new', () => {
    const seen = { total: 1248, circleBest: CIRCLE.bestMs!, fewestTries: 3, longestWord: '' };
    expect(herStats(input({ seen, lifetime: life({ fewestTries: 2, triesCounts: [0, 1, 0, 0, 0, 0, 0] }) })).bests).toMatchObject({ fewestTriesIsNew: true, isNew: true });
    expect(herStats(input({ seen, lifetime: life({ fewestTries: 3, triesCounts: [0, 0, 1, 0, 0, 0, 0] }) })).bests.isNew).toBe(false);
  });
});

describe('card 4: the garden', () => {
  it('grows a flower for each day she played, sized by how much', () => {
    const log = [
      ...Array.from({ length: 9 }, () => rec({ day: '2026-10-20' })),
      rec({ day: '2026-10-19' }),
      ...Array.from({ length: 4 }, () => rec({ day: '2026-10-17' })),
    ];
    const { garden } = herStats(input({ log }));
    expect(garden.flowers).toHaveLength(28);
    expect(garden.flowers.slice(24)).toEqual([2, 0, 1, 3]);
    expect(garden.flowers.slice(0, 24).every((f) => f === 0)).toBe(true);
    expect(garden.caption).toBe('3 flowers in your garden');
  });

  it('invites her to start it', () => {
    expect(herStats(input()).garden.caption).toBe("Your garden starts growing with today's puzzles");
    expect(herStats(input({ log: [rec()] })).garden.caption).toBe('1 flower in your garden');
  });
});

describe('card 5: fun facts', () => {
  it('shows her longest word in capitals, from 5 letters', () => {
    expect(herStats(input({ lifetime: life({ longestWord: 'stranger' }) })).facts.word).toBe('STRANGER');
    expect(herStats(input({ lifetime: life({ longestWord: 'cat' }) })).facts.word).toBeNull();
  });

  it('marks a longer word than last time as new', () => {
    const seen = { total: 1248, circleBest: {}, fewestTries: null, longestWord: 'stone' };
    expect(herStats(input({ seen, lifetime: life({ longestWord: 'stranger' }) })).facts.wordIsNew).toBe(true);
    expect(herStats(input({ seen: { ...seen, longestWord: 'stranger' }, lifetime: life({ longestWord: 'stranger' }) })).facts.wordIsNew).toBe(false);
  });

  it('picks a true fact, changing with the day', () => {
    const lifetime = life({ words: 60, letters: 250 });
    expect(herStats(input({ lifetime, today: '2026-01-01' })).facts.fact).toBe("You've found 60 words");
    expect(herStats(input({ lifetime, today: '2026-01-02' })).facts.fact).toBe("You've spelled 250 letters");
  });

  it('knows her favorite first guess and when she plays', () => {
    const hours = new Array<number>(24).fill(0);
    hours[14] = 10;
    const one = (o: Partial<Lifetime>) => herStats(input({ lifetime: life(o), today: '2026-01-01' })).facts.fact;
    expect(one({ firstGuesses: { crane: 3, slate: 2 } })).toBe('Your favorite first guess is CRANE');
    expect(one({ hours })).toBe("You're an afternoon player");
    expect(one({ mostInADay: 7 })).toBe('Your most in one day: 7');
    expect(one({ firstGuesses: { crane: 2 } })).toBeNull();
  });

  it('invites her to play when there is nothing yet', () => {
    expect(herStats(input()).facts).toEqual({ word: null, wordIsNew: false, fact: null, empty: 'Fun facts appear as you play.' });
  });
});

describe('what she has seen', () => {
  const now = input({ lifetime: life({ fewestTries: 2, longestWord: 'stranger' }) });

  it('takes everything the first time', () => {
    expect(seenAfter(null, now, 1)).toEqual({ total: 1248, circleBest: { easy: 38_000, medium: 72_000 }, fewestTries: 2, longestWord: 'stranger' });
  });

  it('updates only what the card showed', () => {
    const old = { total: 10, circleBest: {}, fewestTries: null, longestWord: 'cat' };
    expect(seenAfter(old, now, 0)).toEqual({ ...old, total: 1248 });
    expect(seenAfter(old, now, 1)).toEqual(old);
    expect(seenAfter(old, now, 2)).toEqual({ ...old, circleBest: { easy: 38_000, medium: 72_000 }, fewestTries: 2 });
    expect(seenAfter(old, now, 4)).toEqual({ ...old, longestWord: 'stranger' });
  });

  it('is saved and loaded, and a damaged copy is ignored', () => {
    const store = new MemoryStore();
    expect(loadSeen(store)).toBeNull();
    const seen = seenAfter(null, now, 0);
    saveSeen(store, seen);
    expect(loadSeen(store)).toEqual(seen);
    store.setItem(SEEN_KEY, '{"total":"lots"}');
    expect(loadSeen(store)).toBeNull();
  });
});
