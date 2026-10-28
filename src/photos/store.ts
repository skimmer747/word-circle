import type { CropAt } from '../jigsaw/crop';

/** A family photo as kept on this iPad. */
export interface FamilyPhoto {
  /** Letters and digits (newPhotoId); its Jigsaw picture is "family:" + id. */
  id: string;
  /** When it was added (ms), for newest first. */
  added: number;
  /** '' for none; at most two lines (cleanCaption). */
  caption: string;
  /** Where the puzzle's 4:3 frame sits in the whole photo. */
  frame: CropAt;
  /** The whole photo with its long side at most 2000 px, so the framing can change later... */
  whole: Blob;
  width: number;
  height: number;
  /** ...the framed 1600 × 1200 copy the puzzle is cut from, and its 448 × 336 thumbnail. */
  framed: Blob;
  thumb: Blob;
}

/** The family's photos on this iPad. They never leave it: no upload, no Share, no analytics. */
export interface PhotoStore {
  /** Every photo, newest first. Rejects if they can't be read. */
  list(): Promise<FamilyPhoto[]>;
  /** Adds a photo, or replaces the one with its id. Rejects if it can't be saved (the iPad may be full). */
  put(photo: FamilyPhoto): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_NAME = 'word-games-photos';
const STORE = 'photos';

export const newestFirst = (photos: readonly FamilyPhoto[]): FamilyPhoto[] => [...photos].sort((a, b) => b.added - a.added);

/** A saved record that has everything a photo needs (anything else is left out, never shown broken). */
function isPhoto(value: unknown): value is FamilyPhoto {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.added === 'number' &&
    typeof p.caption === 'string' &&
    typeof p.frame === 'object' &&
    p.frame !== null &&
    p.whole instanceof Blob &&
    p.framed instanceof Blob &&
    p.thumb instanceof Blob &&
    typeof p.width === 'number' &&
    typeof p.height === 'number'
  );
}

const result = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const committed = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

/** The photos in the app's own IndexedDB database, or null where there is none (some private windows). */
export function openPhotoStore(factory: IDBFactory | undefined = globalThis.indexedDB): PhotoStore | null {
  if (!factory) return null;
  let opening: Promise<IDBDatabase> | null = null;
  let persisted = false;
  const open = (): Promise<IDBDatabase> => {
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error: unknown) => {
      // Tried again next time: the iPad may have been busy.
      opening = null;
      throw error;
    });
    return opening;
  };
  const write = async (change: (store: IDBObjectStore) => void): Promise<void> => {
    const transaction = (await open()).transaction(STORE, 'readwrite');
    change(transaction.objectStore(STORE));
    await committed(transaction);
  };
  return {
    async list() {
      const records: unknown[] = await result((await open()).transaction(STORE).objectStore(STORE).getAll());
      return newestFirst(records.filter(isPhoto));
    },
    async put(photo) {
      await write((store) => store.put(photo));
      // Asks the iPad (once) not to clear the photos when it's short of space. It may say no.
      if (!persisted) {
        persisted = true;
        void navigator.storage?.persist?.().catch(() => false);
      }
    },
    async remove(id) {
      await write((store) => store.delete(id));
    },
  };
}

/** The store, and whether anything was added, changed or removed through it (the settings page reloads the app then). */
export function trackChanges(photos: PhotoStore): { store: PhotoStore; changed: () => boolean } {
  let changed = false;
  return {
    store: {
      list: () => photos.list(),
      put: async (photo) => {
        changed = true;
        await photos.put(photo);
      },
      remove: async (id) => {
        changed = true;
        await photos.remove(id);
      },
    },
    changed: () => changed,
  };
}
