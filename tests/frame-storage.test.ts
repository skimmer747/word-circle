import { describe, expect, it } from 'vitest';
import { FRAME_KEY, loadSavedFrame, saveSavedFrame } from '../src/frame/storage';
import { MemoryStore } from './memory-store';

const SEED = { streakDays: 5, lastPlayedDay: '2026-10-19' };

describe('saving which game is on screen', () => {
  it("starts in Word Circle, carrying over Word Circle's days in a row", () => {
    expect(loadSavedFrame(new MemoryStore(), SEED)).toEqual({ current: 'circle', streakDays: 5, lastPlayedDay: '2026-10-19' });
  });

  it('remembers the game and the days in a row', () => {
    const store = new MemoryStore();
    saveSavedFrame(store, { current: 'guess', streakDays: 2, lastPlayedDay: '2026-10-20' });
    expect(loadSavedFrame(store, SEED)).toEqual({ current: 'guess', streakDays: 2, lastPlayedDay: '2026-10-20' });
  });

  it('falls back to Word Circle and the carried-over days if the save is damaged', () => {
    const damaged = [
      'not json',
      'null',
      '{"current":"chess","streakDays":1,"lastPlayedDay":null}',
      '{"current":"guess","streakDays":-1,"lastPlayedDay":null}',
      '{"current":"guess","streakDays":1,"lastPlayedDay":"yesterday"}',
    ];
    for (const raw of damaged) {
      const store = new MemoryStore();
      store.setItem(FRAME_KEY, raw);
      expect(loadSavedFrame(store, SEED)).toEqual({ current: 'circle', ...SEED });
    }
  });
});
