import { describe, expect, it } from 'vitest';
import { JigsawGame } from '../src/jigsaw/rules';
import {
  JIGSAW_KEY,
  MAX_PLACES,
  freshJigsaw,
  loadSavedJigsaw,
  placeFor,
  recordJigsawSolve,
  saveSavedJigsaw,
  withFinished,
  withPlace,
  withoutPictures,
  withoutPlace,
  type SavedJigsaw,
  type SavedPlace,
} from '../src/jigsaw/storage';
import type { KeyValueStore } from '../src/shared/store';
import { MemoryStore } from './memory-store';

const progress = JigsawGame.fresh('board', 16, 1).progress(1_000);
const place = (picture: string, o: Partial<SavedPlace> = {}): SavedPlace => ({ picture, style: 'board', count: 16, progress, ...o });

describe('saving Jigsaw', () => {
  it('starts on Tray with 9 pieces and nothing done', () => {
    expect(loadSavedJigsaw(new MemoryStore())).toEqual(freshJigsaw());
    expect(freshJigsaw()).toMatchObject({ style: 'tray', count: 9, guide: 'board', hideEdges: false, current: null, places: [], finished: [] });
  });

  it('saves and loads everything', () => {
    const store = new MemoryStore();
    const saved: SavedJigsaw = {
      style: 'table',
      count: 30,
      guide: 'corner',
      hideEdges: true,
      current: 'starter:lake',
      places: [place('starter:lake')],
      finished: ['starter:barn'],
      stats: { totalSolved: 4, todaySolved: 2, lastPlayedDay: '2026-10-28' },
    };
    saveSavedJigsaw(store, saved);
    expect(loadSavedJigsaw(store)).toEqual(saved);
  });

  it('replaces damaged fields and drops damaged places', () => {
    const store = new MemoryStore();
    store.setItem(
      JIGSAW_KEY,
      JSON.stringify({
        style: 'puzzle',
        guide: 'sideways',
        hideEdges: 'yes',
        count: 12,
        current: 5,
        places: [place('starter:a'), { picture: 'starter:b', style: 'tray', count: 9, progress: { placed: 'all' } }, null],
        finished: ['starter:a', 'starter:a', 3],
        stats: { totalSolved: -1 },
      }),
    );
    expect(loadSavedJigsaw(store)).toEqual({ ...freshJigsaw(), places: [place('starter:a')], finished: ['starter:a'] });
    store.setItem(JIGSAW_KEY, 'not json');
    expect(loadSavedJigsaw(store)).toEqual(freshJigsaw());
  });

  it('carries on if storage is unavailable', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
    };
    expect(loadSavedJigsaw(broken)).toEqual(freshJigsaw());
    expect(() => saveSavedJigsaw(broken, freshJigsaw())).not.toThrow();
  });
});

describe('her places', () => {
  it('keeps one place per picture, style and piece count, most recent first', () => {
    let saved = withPlace(freshJigsaw(), place('starter:a'));
    saved = withPlace(saved, place('starter:b'));
    saved = withPlace(saved, place('starter:a', { style: 'tray', count: 9 }));
    saved = withPlace(saved, place('starter:b'));
    expect(saved.places.map((p) => `${p.picture} ${p.style} ${p.count}`)).toEqual(['starter:b board 16', 'starter:a tray 9', 'starter:a board 16']);
    expect(placeFor(saved, 'starter:a', 'tray', 9)?.picture).toBe('starter:a');
    expect(placeFor(saved, 'starter:a', 'table', 9)).toBeUndefined();
  });

  it('keeps at most 20', () => {
    let saved = freshJigsaw();
    for (let i = 0; i < 25; i++) saved = withPlace(saved, place(`starter:p${i}`));
    expect(saved.places).toHaveLength(MAX_PLACES);
    expect(saved.places[0].picture).toBe('starter:p24');
  });

  it('forgets a finished mix and checks the picture once', () => {
    let saved = withPlace(withPlace(freshJigsaw(), place('starter:a')), place('starter:a', { style: 'tray', count: 9 }));
    saved = withFinished(withoutPlace(saved, 'starter:a', 'board', 16), 'starter:a');
    saved = withFinished(saved, 'starter:a');
    expect(saved.places.map((p) => p.style)).toEqual(['tray']);
    expect(saved.finished).toEqual(['starter:a']);
  });

  it('counts finished jigsaws, "today" starting over on a new day', () => {
    const stats = recordJigsawSolve(recordJigsawSolve(freshJigsaw().stats, '2026-10-27'), '2026-10-27');
    expect(stats).toEqual({ totalSolved: 2, todaySolved: 2, lastPlayedDay: '2026-10-27' });
    expect(recordJigsawSolve(stats, '2026-10-28')).toEqual({ totalSolved: 3, todaySolved: 1, lastPlayedDay: '2026-10-28' });
  });
});

describe('forgetting pictures that are gone', () => {
  const progress = { placed: [], queue: [], tray: [null, null, null], loose: [], positions: [], groups: [], order: [], hints: 0, elapsedMs: 0 };
  const saved: SavedJigsaw = {
    ...freshJigsaw(),
    current: 'family:gone',
    places: [
      { picture: 'family:gone', style: 'tray', count: 9, progress },
      { picture: 'starter:lake', style: 'tray', count: 9, progress },
    ],
    finished: ['family:gone', 'starter:lake'],
  };

  it('drops their places, their checks, and the puzzle if it was current', () => {
    const kept = withoutPictures(saved, (id) => id === 'family:gone');
    expect(kept.current).toBeNull();
    expect(kept.places.map((p) => p.picture)).toEqual(['starter:lake']);
    expect(kept.finished).toEqual(['starter:lake']);
  });

  it('keeps everything else as it was', () => {
    expect(withoutPictures(saved, () => false)).toEqual(saved);
  });
});
