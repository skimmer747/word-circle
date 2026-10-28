import { OLD_STORAGE_KEY as OLD_CIRCLE_KEY, STORAGE_KEY as CIRCLE_KEY } from '../circle/storage';
import { GAME_IDS, type GameId } from '../frame/games';
import { THUMBS, type Thumb } from '../frame/layout';
import { FRAME_KEY } from '../frame/storage';
import { GRID_KEY } from '../grid/storage';
import { GUESS_KEY } from '../guess/storage';
import { parseAvoidWords } from '../shared/avoid';
import type { KeyValueStore } from '../shared/store';
import { cleanName } from './name';

export const SETTINGS_KEY = 'word-games:settings:v1';

export const START_LEVELS = ['easy', 'medium', 'hard'] as const;
export type StartLevel = (typeof START_LEVELS)[number];

/** Where the clock's events come from: schedule.txt on the site (Mom's iPad only) or lines typed on this iPad. */
export type ScheduleSetting = { source: 'web' } | { source: 'device'; lines: string[] };

/** What a caregiver sets on the settings page. */
export interface Settings {
  /** Her first name, for the card and the clock greeting; '' for none. */
  name: string;
  thumb: Thumb;
  /** The games she can pick from, in the usual order; at least one. */
  games: GameId[];
  /** Every game this iPad has been offered. A game added to the site later is turned on once, then left as the family sets it. */
  knownGames: GameId[];
  /** Where Word Circle and Word Grid start the first time they're opened. */
  startLevel: StartLevel;
  /** Whether Word Guess offers Share after today's Wordle. */
  share: boolean;
  /** Whether Jigsaw offers the starter pictures as well as the family's own photos. */
  jigsawStarters: boolean;
  schedule: ScheduleSetting;
  /** Extra words kept out of every game. */
  avoid: string[];
}

export interface LoadedSettings {
  settings: Settings;
  /** True on an iPad that has never been set up or played: show the setup page first. */
  firstTime: boolean;
}

/** The games every iPad had before settings remembered which games they'd been offered. */
const FIRST_GAMES: readonly GameId[] = ['circle', 'guess', 'grid'];

/** A new iPad starts with these. */
export function newIpadSettings(): Settings {
  return {
    name: '',
    thumb: 'left',
    games: [...GAME_IDS],
    knownGames: [...GAME_IDS],
    startLevel: 'medium',
    share: true,
    jigsawStarters: true,
    schedule: { source: 'device', lines: [] },
    avoid: [],
  };
}

/**
 * Mom's iPad (it has progress from before settings existed) carries on exactly as it was: her left thumb,
 * schedule.txt from the site, and Word Grid starting on Easy as it always has (Word Circle already has her level).
 */
export function momsIpadSettings(): Settings {
  return { ...newIpadSettings(), startLevel: 'easy', schedule: { source: 'web' } };
}

/** Any of these means the iPad was played on before settings existed. */
const PROGRESS_KEYS = [FRAME_KEY, CIRCLE_KEY, OLD_CIRCLE_KEY, GUESS_KEY, GRID_KEY];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function readSchedule(value: unknown): ScheduleSetting | null {
  if (!isRecord(value)) return null;
  if (value.source === 'web') return { source: 'web' };
  if (value.source === 'device' && Array.isArray(value.lines) && value.lines.every((line) => typeof line === 'string')) {
    return { source: 'device', lines: value.lines as string[] };
  }
  return null;
}

/** A saved copy, field by field. Anything damaged gets the new-iPad default, so a bad save never brings in schedule.txt. */
function readSettings(value: unknown): Settings {
  const settings = newIpadSettings();
  if (!isRecord(value)) return settings;
  if (typeof value.name === 'string') settings.name = cleanName(value.name);
  if (THUMBS.includes(value.thumb as Thumb)) settings.thumb = value.thumb as Thumb;
  const known = Array.isArray(value.knownGames) ? GAME_IDS.filter((id) => (value.knownGames as unknown[]).includes(id)) : FIRST_GAMES;
  if (Array.isArray(value.games)) {
    const saved = value.games as unknown[];
    const kept = GAME_IDS.filter((id) => saved.includes(id));
    // Games this iPad hasn't been offered yet are turned on.
    if (kept.length > 0) settings.games = GAME_IDS.filter((id) => kept.includes(id) || !known.includes(id));
  }
  if (START_LEVELS.includes(value.startLevel as StartLevel)) settings.startLevel = value.startLevel as StartLevel;
  if (typeof value.share === 'boolean') settings.share = value.share;
  if (typeof value.jigsawStarters === 'boolean') settings.jigsawStarters = value.jigsawStarters;
  settings.schedule = readSchedule(value.schedule) ?? settings.schedule;
  if (Array.isArray(value.avoid)) settings.avoid = parseAvoidWords(value.avoid.filter((word) => typeof word === 'string').join(' '));
  return settings;
}

function hasProgress(store: KeyValueStore): boolean {
  try {
    return PROGRESS_KEYS.some((key) => store.getItem(key) !== null);
  } catch {
    return false;
  }
}

export function loadSettings(store: KeyValueStore): LoadedSettings {
  let raw: string | null;
  try {
    raw = store.getItem(SETTINGS_KEY);
  } catch {
    // Storage unavailable: play with the defaults rather than ask for a setup that couldn't be saved.
    return { settings: newIpadSettings(), firstTime: false };
  }
  if (raw !== null) {
    let value: unknown = null;
    try {
      value = JSON.parse(raw);
    } catch {
      // Unreadable save: the defaults, below.
    }
    return { settings: readSettings(value), firstTime: false };
  }
  if (hasProgress(store)) {
    const settings = momsIpadSettings();
    saveSettings(store, settings);
    return { settings, firstTime: false };
  }
  return { settings: newIpadSettings(), firstTime: true };
}

/** Returns false if it couldn't be saved. */
export function saveSettings(store: KeyValueStore, settings: Settings): boolean {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
