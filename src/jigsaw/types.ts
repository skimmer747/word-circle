import type { PlayLevel } from '../stats/log';

/** Pieces come from a tray onto a board, the same but left where she drops them, or loose on a table. */
export const JIGSAW_STYLES = ['tray', 'board', 'table'] as const;
export type JigsawStyle = (typeof JIGSAW_STYLES)[number];

export const PIECE_COUNTS = [9, 16, 30] as const;
export type PieceCount = (typeof PIECE_COUNTS)[number];

/** Columns and rows of pieces on a landscape 4:3 picture. */
export const GRID_SIZES: Record<PieceCount, { cols: number; rows: number }> = {
  9: { cols: 3, rows: 3 },
  16: { cols: 4, rows: 4 },
  30: { cols: 6, rows: 5 },
};

/** The play log keeps piece counts as levels, so her stats treat 9, 16 and 30 like Easy, Medium and Hard. */
export const COUNT_LEVELS: Record<PieceCount, PlayLevel> = { 9: 'easy', 16: 'medium', 30: 'hard' };
/** The piece counts' buttons say Easy, Medium and Hard, like every game's levels. */
export const COUNT_LABELS: Record<PieceCount, string> = { 9: 'Easy', 16: 'Medium', 30: 'Hard' };
export const LEVEL_COUNTS: Record<PlayLevel, PieceCount> = { easy: 9, medium: 16, hard: 30 };

/** Every puzzle is a landscape picture this shape. */
export const PICTURE_ASPECT = 4 / 3;

export interface Point {
  x: number;
  y: number;
}

/** A picture she can make into a puzzle. */
export interface Picture {
  /** "starter:lake" (family photos will be "family:…"). */
  id: string;
  /** The 4:3 picture, 1600 × 1200. */
  src: string;
  /** Its 448 × 336 thumbnail. */
  thumb: string;
  /** '' for none. */
  caption: string;
  /** A starter's hand-drawn cartoon of the same scene, the same sizes as the photo and its thumbnail. */
  cartoon?: { src: string; thumb: string };
}

/** Her place in one puzzle, as saved. Positions are in pieces (see rules.ts). */
export interface JigsawProgress {
  /** Pieces in their spots (Tray and Board). */
  placed: number[];
  /** Pieces not handed out yet, next first (Tray and Board). */
  queue: number[];
  /** The tray's places, left to right: a piece, or null (Tray and Board). */
  tray: Array<number | null>;
  /** Pieces left lying around, bottom first: [piece, x, y] (Board). */
  loose: Array<[number, number, number]>;
  /** Every piece's [x, y] (Table). */
  positions: Array<[number, number]>;
  /** Every piece's group (Table): pieces with the same number are joined. */
  groups: number[];
  /** Table pieces, bottom first. */
  order: number[];
  hints: number;
  elapsedMs: number;
}
