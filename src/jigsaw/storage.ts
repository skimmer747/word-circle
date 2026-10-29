import type { KeyValueStore } from '../shared/store';
import { JIGSAW_STYLES, PIECE_COUNTS, type JigsawProgress, type JigsawStyle, type PieceCount } from './types';

export const JIGSAW_KEY = 'word-games:jigsaw:v1';
/** Her place is kept in this many picture / style / piece-count mixes, most recent first. */
export const MAX_PLACES = 20;

/** Where the guide picture can be. */
export const GUIDES = ['board', 'corner'] as const;
export type Guide = (typeof GUIDES)[number];

/** Her place in one mix. */
export interface SavedPlace {
  picture: string;
  style: JigsawStyle;
  count: PieceCount;
  progress: JigsawProgress;
}

export interface JigsawStats {
  totalSolved: number;
  todaySolved: number;
  lastPlayedDay: string | null;
}

/** Her style and piece count, the picture in progress, her places, the pictures she has finished, and her counts. */
export interface SavedJigsaw {
  style: JigsawStyle;
  count: PieceCount;
  /** Where the guide picture is: faint on the board, or small in the bottom-right corner (Tray and Board). */
  guide: Guide;
  /** Hide edges: corner and side pieces look like middle ones until they're in place. */
  hideEdges: boolean;
  /** Cartoons: starters show their hand-drawn cartoon instead of the photo. */
  cartoons: boolean;
  /** The picture in progress, or null while she's choosing one. */
  current: string | null;
  places: SavedPlace[];
  finished: string[];
  stats: JigsawStats;
}

export function freshJigsaw(): SavedJigsaw {
  return { style: 'tray', count: 9, guide: 'board', hideEdges: false, cartoons: false, current: null, places: [], finished: [], stats: { totalSolved: 0, todaySolved: 0, lastPlayedDay: null } };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isCountList = (value: unknown): value is number[] => Array.isArray(value) && value.every(isCount);
const isTuple = (value: unknown, length: number) => Array.isArray(value) && value.length === length && value.every(isNumber);

/** The saved shape only; whether it fits its puzzle is JigsawGame.restore's job. */
function readProgress(v: unknown): JigsawProgress | null {
  if (!isRecord(v)) return null;
  const { placed, queue, tray, loose, positions, groups, order, hints, elapsedMs } = v;
  if (!isCountList(placed) || !isCountList(queue) || !isCountList(groups) || !isCountList(order)) return null;
  if (!Array.isArray(tray) || !tray.every((id) => id === null || isCount(id))) return null;
  if (!Array.isArray(loose) || !loose.every((entry) => isTuple(entry, 3) && isCount((entry as number[])[0]))) return null;
  if (!Array.isArray(positions) || !positions.every((entry) => isTuple(entry, 2))) return null;
  if (!isCount(hints) || !isNumber(elapsedMs) || elapsedMs < 0) return null;
  return {
    placed,
    queue,
    tray: tray as Array<number | null>,
    loose: loose as Array<[number, number, number]>,
    positions: positions as Array<[number, number]>,
    groups,
    order,
    hints,
    elapsedMs,
  };
}

function readPlace(v: unknown): SavedPlace | null {
  if (!isRecord(v) || typeof v.picture !== 'string') return null;
  if (!JIGSAW_STYLES.includes(v.style as JigsawStyle) || !PIECE_COUNTS.includes(v.count as PieceCount)) return null;
  const progress = readProgress(v.progress);
  return progress && { picture: v.picture, style: v.style as JigsawStyle, count: v.count as PieceCount, progress };
}

function readStats(v: unknown): JigsawStats {
  if (
    isRecord(v) &&
    isCount(v.totalSolved) &&
    isCount(v.todaySolved) &&
    (v.lastPlayedDay === null || (typeof v.lastPlayedDay === 'string' && DAY.test(v.lastPlayedDay)))
  ) {
    return { totalSolved: v.totalSolved, todaySolved: v.todaySolved, lastPlayedDay: v.lastPlayedDay };
  }
  return freshJigsaw().stats;
}

/** Loads the save field by field; anything damaged gets the fresh value. */
export function loadSavedJigsaw(store: KeyValueStore): SavedJigsaw {
  const saved = freshJigsaw();
  let value: unknown = null;
  try {
    const raw = store.getItem(JIGSAW_KEY);
    value = raw === null ? null : JSON.parse(raw);
  } catch {
    // Unreadable or unavailable: a fresh start.
  }
  if (!isRecord(value)) return saved;
  if (JIGSAW_STYLES.includes(value.style as JigsawStyle)) saved.style = value.style as JigsawStyle;
  if (PIECE_COUNTS.includes(value.count as PieceCount)) saved.count = value.count as PieceCount;
  if (GUIDES.includes(value.guide as Guide)) saved.guide = value.guide as Guide;
  if (typeof value.hideEdges === 'boolean') saved.hideEdges = value.hideEdges;
  if (typeof value.cartoons === 'boolean') saved.cartoons = value.cartoons;
  if (typeof value.current === 'string') saved.current = value.current;
  if (Array.isArray(value.places)) saved.places = value.places.map(readPlace).filter((p): p is SavedPlace => p !== null).slice(0, MAX_PLACES);
  if (Array.isArray(value.finished)) saved.finished = [...new Set(value.finished.filter((id): id is string => typeof id === 'string'))];
  saved.stats = readStats(value.stats);
  return saved;
}

export function saveSavedJigsaw(store: KeyValueStore, saved: SavedJigsaw): void {
  try {
    store.setItem(JIGSAW_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or unavailable: this session still works.
  }
}

const isMix = (place: SavedPlace, picture: string, style: JigsawStyle, count: PieceCount) =>
  place.picture === picture && place.style === style && place.count === count;

export function placeFor(saved: SavedJigsaw, picture: string, style: JigsawStyle, count: PieceCount): SavedPlace | undefined {
  return saved.places.find((place) => isMix(place, picture, style, count));
}

/** Her place in this mix, moved to the front (the oldest beyond 20 are forgotten). */
export function withPlace(saved: SavedJigsaw, place: SavedPlace): SavedJigsaw {
  const others = saved.places.filter((p) => !isMix(p, place.picture, place.style, place.count));
  return { ...saved, places: [place, ...others].slice(0, MAX_PLACES) };
}

export function withoutPlace(saved: SavedJigsaw, picture: string, style: JigsawStyle, count: PieceCount): SavedJigsaw {
  return { ...saved, places: saved.places.filter((p) => !isMix(p, picture, style, count)) };
}

/** Forgets pictures that are gone (removed family photos): their places, their checks, and the puzzle if it was current. */
export function withoutPictures(saved: SavedJigsaw, gone: (picture: string) => boolean): SavedJigsaw {
  return {
    ...saved,
    current: saved.current !== null && gone(saved.current) ? null : saved.current,
    places: saved.places.filter((place) => !gone(place.picture)),
    finished: saved.finished.filter((picture) => !gone(picture)),
  };
}

/** Gives the picture its check on the picture page. */
export function withFinished(saved: SavedJigsaw, picture: string): SavedJigsaw {
  return saved.finished.includes(picture) ? saved : { ...saved, finished: [...saved.finished, picture] };
}

/** Counts a finished jigsaw; "today" starts over on a new day. */
export function recordJigsawSolve(stats: JigsawStats, day: string): JigsawStats {
  return {
    totalSolved: stats.totalSolved + 1,
    todaySolved: stats.lastPlayedDay === day ? stats.todaySolved + 1 : 1,
    lastPlayedDay: day,
  };
}
