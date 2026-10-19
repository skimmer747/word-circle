import type { KeyValueStore } from '../src/shared/store';

/** An in-memory stand-in for localStorage. */
export class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}
