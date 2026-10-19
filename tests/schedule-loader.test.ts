import { describe, expect, it } from 'vitest';
import { SCHEDULE_CACHE_KEY, cachedSchedule, refreshSchedule } from '../src/clock/loader';
import type { KeyValueStore } from '../src/game/storage';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('schedule loading', () => {
  it('fetches the list, remembers it, and returns the events', async () => {
    const store = new MemoryStore();
    const events = await refreshSchedule(async () => 'every day 5 PM Supper', store);
    expect(events?.map((e) => e.name)).toEqual(['Supper']);
    expect(store.getItem(SCHEDULE_CACHE_KEY)).toBe('every day 5 PM Supper');
    expect(cachedSchedule(store).map((e) => e.name)).toEqual(['Supper']);
  });

  it('keeps the last list it saw when offline', async () => {
    const store = new MemoryStore();
    store.setItem(SCHEDULE_CACHE_KEY, 'every day 12 PM Lunch');
    const events = await refreshSchedule(async () => {
      throw new Error('offline');
    }, store);
    expect(events).toBeNull();
    expect(cachedSchedule(store).map((e) => e.name)).toEqual(['Lunch']);
  });

  it('has no events before it has ever loaded the list', () => {
    expect(cachedSchedule(new MemoryStore())).toEqual([]);
  });

  it('never throws if storage is unavailable', async () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(cachedSchedule(broken)).toEqual([]);
    expect((await refreshSchedule(async () => 'every day 5 PM Supper', broken))?.length).toBe(1);
  });
});
