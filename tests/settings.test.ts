import { describe, expect, it } from 'vitest';
import { OLD_STORAGE_KEY as OLD_CIRCLE_KEY, STORAGE_KEY as CIRCLE_KEY } from '../src/circle/storage';
import { FRAME_KEY } from '../src/frame/storage';
import { GRID_KEY } from '../src/grid/storage';
import { GUESS_KEY } from '../src/guess/storage';
import {
  SETTINGS_KEY,
  loadSettings,
  momsIpadSettings,
  newIpadSettings,
  saveSettings,
  type Settings,
} from '../src/settings/settings';
import type { KeyValueStore } from '../src/shared/store';
import { MemoryStore } from './memory-store';

describe('loading settings', () => {
  it('asks for setup on a brand-new iPad', () => {
    expect(loadSettings(new MemoryStore())).toEqual({ settings: newIpadSettings(), firstTime: true });
  });

  it.each([FRAME_KEY, CIRCLE_KEY, OLD_CIRCLE_KEY, GUESS_KEY, GRID_KEY])(
    "treats an iPad with progress under %s as Mom's, and saves that",
    (key) => {
      const store = new MemoryStore();
      store.setItem(key, '{}');
      expect(loadSettings(store)).toEqual({ settings: momsIpadSettings(), firstTime: false });
      expect(JSON.parse(store.getItem(SETTINGS_KEY)!)).toEqual(momsIpadSettings());
    },
  );

  it("keeps Mom's iPad as it is: schedule.txt, left thumb, every game, Share, Word Grid from Easy", () => {
    expect(momsIpadSettings()).toEqual({
      name: '',
      thumb: 'left',
      games: ['circle', 'guess', 'grid', 'jigsaw'],
      knownGames: ['circle', 'guess', 'grid', 'jigsaw'],
      startLevel: 'easy',
      share: true,
      schedule: { source: 'web' },
      avoid: [],
    });
  });

  it('gives new iPads a schedule of their own, never schedule.txt', () => {
    expect(newIpadSettings()).toEqual({
      name: '',
      thumb: 'left',
      games: ['circle', 'guess', 'grid', 'jigsaw'],
      knownGames: ['circle', 'guess', 'grid', 'jigsaw'],
      startLevel: 'medium',
      share: true,
      schedule: { source: 'device', lines: [] },
      avoid: [],
    });
  });

  it('loads saved settings', () => {
    const saved: Settings = {
      name: 'Ruth',
      thumb: 'right',
      games: ['grid'],
      knownGames: ['circle', 'guess', 'grid', 'jigsaw'],
      startLevel: 'hard',
      share: false,
      schedule: { source: 'device', lines: ['every day 6:00 PM Supper'] },
      avoid: ['grave'],
    };
    const store = new MemoryStore();
    expect(saveSettings(store, saved)).toBe(true);
    expect(loadSettings(store)).toEqual({ settings: saved, firstTime: false });
  });

  it('replaces only the damaged fields, with new-iPad defaults', () => {
    const store = new MemoryStore();
    store.setItem(
      SETTINGS_KEY,
      JSON.stringify({ name: 7, thumb: 'up', games: ['chess'], startLevel: 'expert', share: 'yes', schedule: { source: 'ftp' }, avoid: 'grave' }),
    );
    expect(loadSettings(store)).toEqual({ settings: newIpadSettings(), firstTime: false });
    store.setItem(SETTINGS_KEY, JSON.stringify({ name: 'Ruth', thumb: 'up' }));
    expect(loadSettings(store).settings).toEqual({ ...newIpadSettings(), name: 'Ruth' });
  });

  it('never goes back to setup, or to schedule.txt, after a damaged save', () => {
    const store = new MemoryStore();
    store.setItem(FRAME_KEY, '{}');
    store.setItem(SETTINGS_KEY, 'not json');
    expect(loadSettings(store)).toEqual({ settings: newIpadSettings(), firstTime: false });
  });

  it('tidies what it loads', () => {
    const store = new MemoryStore();
    store.setItem(SETTINGS_KEY, JSON.stringify({ name: '  Ruth   Anne ', games: ['grid', 'circle', 'grid'], avoid: ['Grave', 'grave', 'ill!'] }));
    expect(loadSettings(store).settings).toMatchObject({ name: 'Ruth Anne', games: ['circle', 'grid', 'jigsaw'], avoid: ['grave', 'ill'] });
  });

  it('turns a game added to the site on once, then leaves it as the family set it', () => {
    const store = new MemoryStore();
    // Saved before Jigsaw existed: no knownGames.
    store.setItem(SETTINGS_KEY, JSON.stringify({ ...newIpadSettings(), games: ['circle', 'guess'], knownGames: undefined }));
    expect(loadSettings(store).settings).toMatchObject({ games: ['circle', 'guess', 'jigsaw'], knownGames: ['circle', 'guess', 'grid', 'jigsaw'] });
    // Saved since: Jigsaw turned off stays off.
    saveSettings(store, { ...newIpadSettings(), games: ['circle', 'guess'] });
    expect(loadSettings(store).settings.games).toEqual(['circle', 'guess']);
  });

  it('plays with the defaults, without setup, if storage is unavailable', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
    };
    expect(loadSettings(broken)).toEqual({ settings: newIpadSettings(), firstTime: false });
    expect(saveSettings(broken, newIpadSettings())).toBe(false);
  });
});
