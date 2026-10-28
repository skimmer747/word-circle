# Jigsaw Part 2: Family Photos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A family member (or she) can add a photo from the iPad's photo library, frame it, caption it and play it as a jigsaw; the settings page gets a "Jigsaw pictures" section to add several photos, edit captions and framing, remove photos, and hide the starter pictures.

**Architecture:** Family photos live in the app's own IndexedDB database behind a small `PhotoStore` interface (an in-memory fake for tests). Each photo is kept whole (long side ≤ 2000 px) plus a framed 1600 × 1200 copy and a 448 × 336 thumbnail, so the game treats family photos exactly like starter pictures (4:3 images with a caption). Adding opens the iPad's picker from a tap through the touch tracker, then a "Your new puzzle" page (ordinary DOM, while the frame's touch tracker is paused through a new `FrameHost.cover()`), where the photo is dragged under a fixed 4:3 frame and captioned. Jigsaw is the only writer of its saved state, so it forgets removed photos itself when the list loads.

**Tech Stack:** TypeScript, Vite, Vitest (node environment, no DOM), IndexedDB, canvas `toBlob` JPEG encoding.

**Spec:** `docs/superpowers/specs/2026-10-28-jigsaw-design.md` §3 (picture page, adding a photo in the game, settings page, where family photos live), §5 (removed photos) and §6 (testing). Changes since the spec was written: captions under thumbnails now wrap onto two lines (b415350); the picture page shows six pictures when photos can't be kept.

**Where:** the `jigsaw` worktree (`.worktrees/jigsaw`), on top of part 1. Run commands from the worktree.

**Conventions:** match the surrounding code (short JSDoc-style comments that say why, plain-English names, no abbreviations in user-facing text). Commit after every task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push without the owner's go-ahead.

---

## File structure

| File | Responsibility |
|---|---|
| `src/photos/framing.ts` (new) | Pure sizes and rules: kept sizes, dragging the frame, cleaning captions, new photo ids |
| `src/photos/store.ts` (new) | `FamilyPhoto`, `PhotoStore`, the IndexedDB store, change tracking |
| `src/photos/family.ts` (new) | Family photos as Jigsaw pictures; the whole picture list (family newest first, then starters) |
| `src/photos/shrink.ts` (new) | Browser only: decode a photo, make the kept, framed and thumbnail JPEGs |
| `src/photos/picker.ts` (new) | Browser only: open the iPad's photo picker from a tap |
| `src/photos/adder.ts` (new) | Browser only: pick → "Your new puzzle" → save, for the game |
| `src/jigsaw/new-photo.ts` (new) | "Your new puzzle" / "Change framing" page |
| `src/settings/controls.ts` (new) | `section`, `button`, `checkbox` moved out of `page.ts` so the photo section can share them |
| `src/settings/jigsaw-pictures.ts` (new) | The "Jigsaw pictures" settings section |
| `src/jigsaw/crop.ts` | Export `clamp01` |
| `src/jigsaw/layout.ts` | `computeNewPhotoLayout` |
| `src/jigsaw/pictures.ts` | `PAGE_WITH_ADD` |
| `src/jigsaw/picture-page.ts` | The Add a photo tile |
| `src/jigsaw/storage.ts` | `withoutPictures` |
| `src/jigsaw/screen.ts` | Picture list with family ids, Add a photo flow, forgetting removed photos |
| `src/frame/games.ts`, `src/frame/frame.ts` | `FrameHost.cover()` |
| `src/settings/settings.ts` | `jigsawStarters` |
| `src/settings/page.ts` | Uses `controls.ts`; adds the photo section |
| `src/main.ts` | Wiring: photo store, picture list, adder, settings Cancel after photo changes |
| `src/ui/icons.ts`, `src/styles.css` | Plus icon; Add tile, new photo page, settings photo rows, captions keep line breaks |
| `tests/memory-photos.ts` (new) | In-memory `PhotoStore` |
| `tests/photo-framing.test.ts`, `tests/photo-family.test.ts` (new) | Pure tests |
| `tests/jigsaw-layout.test.ts`, `tests/jigsaw-pictures.test.ts`, `tests/jigsaw-storage.test.ts`, `tests/settings.test.ts` | New cases |

---

### Task 1: Framing rules

**Files:**
- Modify: `src/jigsaw/crop.ts`
- Create: `src/photos/framing.ts`
- Test: `tests/photo-framing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/photo-framing.test.ts
import { describe, expect, it } from 'vitest';
import { MAX_CAPTION, cleanCaption, dragFrame, fitLongSide, newPhotoId } from '../src/photos/framing';

describe('the size a family photo is kept at', () => {
  it('shrinks the long side to 2000 px, keeping the shape', () => {
    expect(fitLongSide(4032, 3024)).toEqual({ w: 2000, h: 1500 });
    expect(fitLongSide(3024, 4032)).toEqual({ w: 1500, h: 2000 });
  });

  it('never makes a small photo bigger', () => {
    expect(fitLongSide(800, 600)).toEqual({ w: 800, h: 600 });
  });
});

describe('dragging the photo under the frame', () => {
  // 2000 × 1000: the frame is 1332 × 999, with 668 px spare across and 1 px down.
  it('moves the frame the other way across the photo', () => {
    const at = dragFrame({ x: 0.5, y: 0.25 }, 2000, 1000, 0.5, 100, 0);
    expect(at.x).toBeCloseTo(0.5 - 200 / 668);
    expect(at.y).toBe(0.25);
  });

  it('keeps the frame inside the photo', () => {
    expect(dragFrame({ x: 0.5, y: 0.25 }, 2000, 1000, 0.5, 5000, 0).x).toBe(0);
    expect(dragFrame({ x: 0.5, y: 0.25 }, 2000, 1000, 0.5, -5000, 0).x).toBe(1);
  });

  it('only moves up and down in a tall photo', () => {
    // 1500 × 2000: the frame is 1500 × 1125, with 875 px spare down and none across.
    const at = dragFrame({ x: 0.5, y: 0.25 }, 1500, 2000, 1, 40, -100);
    expect(at.x).toBe(0.5);
    expect(at.y).toBeCloseTo(0.25 + 100 / 875);
  });
});

describe('a caption as saved', () => {
  it('keeps at most two lines, each trimmed', () => {
    expect(cleanCaption('  Rose and Al,\n\n  Lake George,   1987  \nextra')).toBe('Rose and Al,\nLake George, 1987');
  });

  it('is at most 80 characters', () => {
    expect(cleanCaption('a'.repeat(100))).toHaveLength(MAX_CAPTION);
  });

  it('is empty when nothing was typed', () => {
    expect(cleanCaption(' \n ')).toBe('');
  });
});

describe('a new photo id', () => {
  it('is letters and digits only', () => {
    expect(newPhotoId(1_793_000_000_000, () => 0.5)).toMatch(/^[a-z0-9]+$/);
  });

  it('differs for photos added in the same moment', () => {
    expect(newPhotoId(5, () => 0.1)).not.toBe(newPhotoId(5, () => 0.2));
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/photo-framing.test.ts`
Expected: FAIL, cannot find module `../src/photos/framing`.

- [ ] **Step 3: Export `clamp01` from `src/jigsaw/crop.ts`**

Change `const clamp01 =` to `export const clamp01 =` (the comment above it stays).

- [ ] **Step 4: Write `src/photos/framing.ts`**

```ts
import { clamp01, cropRect, type CropAt } from '../jigsaw/crop';

/** A family photo is kept whole with its long side at most this, so its framing can change later. */
export const WHOLE_MAX = 2000;
/** The framed copy the puzzle is cut from, the size of a starter picture. */
export const FRAMED = { w: 1600, h: 1200 } as const;
/** Its thumbnail on "Pick a picture". */
export const THUMB = { w: 448, h: 336 } as const;
/** A caption is at most this many characters... */
export const MAX_CAPTION = 80;
/** ...on at most this many lines. */
const MAX_CAPTION_LINES = 2;

/** The size a width × height photo is kept at: its long side at most `max`, never made bigger. */
export function fitLongSide(width: number, height: number, max = WHOLE_MAX): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) };
}

/**
 * She dragged the photo by (dx, dy) screen px from where it was with the frame `at`, while the photo is shown at
 * `scale` times its size: the frame moves the other way across the photo, never outside it.
 */
export function dragFrame(at: Readonly<CropAt>, width: number, height: number, scale: number, dx: number, dy: number): CropAt {
  const crop = cropRect(width, height, at);
  const spareW = width - crop.w;
  const spareH = height - crop.h;
  return {
    x: spareW > 0 ? clamp01(at.x - dx / scale / spareW) : at.x,
    y: spareH > 0 ? clamp01(at.y - dy / scale / spareH) : at.y,
  };
}

/** A caption as saved: at most two lines, each trimmed with single spaces, and at most 80 characters in all. */
export function cleanCaption(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);
  return lines.slice(0, MAX_CAPTION_LINES).join('\n').slice(0, MAX_CAPTION).trim();
}

/** A new family photo's id: the time and a random part, letters and digits only, so it's safe in a picture id. */
export function newPhotoId(now: number, random: () => number = Math.random): string {
  return `${Math.max(0, Math.floor(now)).toString(36)}${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/photo-framing.test.ts tests/jigsaw-lib.test.ts`
Expected: PASS (jigsaw-lib uses `crop.ts` too).

- [ ] **Step 6: Commit**

```bash
git add src/jigsaw/crop.ts src/photos/framing.ts tests/photo-framing.test.ts
git commit -m "feat: framing rules for family photos (kept size, dragging the frame, captions, ids)"
```

---

### Task 2: The photo store and the picture list

**Files:**
- Create: `src/photos/store.ts`, `src/photos/family.ts`, `tests/memory-photos.ts`
- Test: `tests/photo-family.test.ts`

- [ ] **Step 1: Write the in-memory store for tests**

```ts
// tests/memory-photos.ts
import { newestFirst, type FamilyPhoto, type PhotoStore } from '../src/photos/store';

/** An in-memory stand-in for the IndexedDB photo store. `failing` makes every call reject, like a full iPad. */
export class MemoryPhotos implements PhotoStore {
  photos = new Map<string, FamilyPhoto>();
  failing = false;

  async list(): Promise<FamilyPhoto[]> {
    this.check();
    return newestFirst([...this.photos.values()]);
  }

  async put(photo: FamilyPhoto): Promise<void> {
    this.check();
    this.photos.set(photo.id, photo);
  }

  async remove(id: string): Promise<void> {
    this.check();
    this.photos.delete(id);
  }

  private check(): void {
    if (this.failing) throw new Error('unavailable');
  }
}

/** A family photo with stand-in images. */
export function photo(id: string, added: number, caption = ''): FamilyPhoto {
  const image = new Blob([id], { type: 'image/jpeg' });
  return { id, added, caption, frame: { x: 0.5, y: 0.25 }, whole: image, width: 2000, height: 1500, framed: image, thumb: image };
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/photo-family.test.ts
import { describe, expect, it } from 'vitest';
import type { Picture } from '../src/jigsaw/types';
import { familyPicture, loadPictureList } from '../src/photos/family';
import { trackChanges } from '../src/photos/store';
import { MemoryPhotos, photo } from './memory-photos';

const starter: Picture = { id: 'starter:lake', src: '/jigsaw/lake.jpg', thumb: '/jigsaw/lake.thumb.jpg', caption: 'Lake' };
const starters = async () => [starter];
const url = () => 'blob:test';

describe('the picture list', () => {
  it('has family photos newest first, then the starter pictures', async () => {
    const photos = new MemoryPhotos();
    await photos.put(photo('old', 1, 'Rose'));
    await photos.put(photo('new', 2, 'Al'));
    const list = await loadPictureList(photos, starters, url);
    expect(list.pictures.map((p) => p.id)).toEqual(['family:new', 'family:old', 'starter:lake']);
    expect(list.pictures[0]).toEqual({ id: 'family:new', src: 'blob:test', thumb: 'blob:test', caption: 'Al' });
    expect(list.family).toEqual(['family:new', 'family:old']);
  });

  it("lists only the starters, and doesn't know the family photos, when they can't be read", async () => {
    const photos = new MemoryPhotos();
    await photos.put(photo('a', 1));
    photos.failing = true;
    const list = await loadPictureList(photos, starters, url);
    expect(list.pictures.map((p) => p.id)).toEqual(['starter:lake']);
    expect(list.family).toBeNull();
  });

  it("has no family photos where photos can't be kept", async () => {
    const list = await loadPictureList(null, starters, url);
    expect(list).toEqual({ pictures: [starter], family: [] });
  });

  it('leaves the starters out when the family hides them', async () => {
    const photos = new MemoryPhotos();
    await photos.put(photo('a', 1));
    const list = await loadPictureList(photos, async () => [], url);
    expect(list.pictures.map((p) => p.id)).toEqual(['family:a']);
  });

  it('uses the framed copy for the puzzle and the thumbnail for the tile', () => {
    const saved = photo('a', 1);
    const framed = new Blob(['framed']);
    const thumb = new Blob(['thumb']);
    const names = new Map([
      [framed, 'blob:framed'],
      [thumb, 'blob:thumb'],
    ]);
    expect(familyPicture({ ...saved, framed, thumb }, (blob) => names.get(blob)!)).toMatchObject({ src: 'blob:framed', thumb: 'blob:thumb' });
  });
});

describe('watching the photo store for changes', () => {
  it('notices adding, changing and removing', async () => {
    const photos = new MemoryPhotos();
    const watched = trackChanges(photos);
    await watched.store.list();
    expect(watched.changed()).toBe(false);
    await watched.store.put(photo('a', 1));
    expect(watched.changed()).toBe(true);
    const again = trackChanges(photos);
    await again.store.remove('a');
    expect(again.changed()).toBe(true);
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run tests/photo-family.test.ts`
Expected: FAIL, cannot find module `../src/photos/store`.

- [ ] **Step 4: Write `src/photos/store.ts`**

```ts
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
      const records = await result((await open()).transaction(STORE).objectStore(STORE).getAll());
      return newestFirst(records.filter(isPhoto));
    },
    async put(photo) {
      await write((store) => store.put(photo));
      // Asks the iPad not to clear the photos when it's short of space. It may say no.
      void navigator.storage?.persist?.().catch(() => false);
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
```

- [ ] **Step 5: Write `src/photos/family.ts`**

```ts
import type { Picture } from '../jigsaw/types';
import type { FamilyPhoto, PhotoStore } from './store';

/** Family photos' picture ids start with this; the rest is the photo's id. */
export const FAMILY = 'family:';

/** What "Pick a picture" lists, and the family photos' picture ids (null if they couldn't be read). */
export interface PictureList {
  pictures: Picture[];
  family: string[] | null;
}

/** A family photo as one of Jigsaw's pictures. `url` gives an address for a stored image. */
export function familyPicture(photo: FamilyPhoto, url: (blob: Blob) => string): Picture {
  return { id: `${FAMILY}${photo.id}`, src: url(photo.framed), thumb: url(photo.thumb), caption: photo.caption };
}

/** Family photos newest first, then the starter pictures (`starters` gives none when the family hides them). */
export async function loadPictureList(
  photos: PhotoStore | null,
  starters: () => Promise<Picture[]>,
  url: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
): Promise<PictureList> {
  const [family, shown] = await Promise.all([photos ? photos.list().catch(() => null) : Promise.resolve([]), starters()]);
  const pictures = (family ?? []).map((photo) => familyPicture(photo, url));
  return { pictures: [...pictures, ...shown], family: family ? pictures.map((picture) => picture.id) : null };
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/photo-family.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/photos/store.ts src/photos/family.ts tests/memory-photos.ts tests/photo-family.test.ts
git commit -m "feat: family photo store (IndexedDB) and the picture list with family photos first"
```

---

### Task 3: Making the kept, framed and thumbnail copies

Browser-only (canvas); checked in the browser in Task 9.

**Files:**
- Create: `src/photos/shrink.ts`

- [ ] **Step 1: Write `src/photos/shrink.ts`**

```ts
import type { Rect } from '../frame/layout';
import { cropRect, type CropAt } from '../jigsaw/crop';
import { FRAMED, THUMB, fitLongSide } from './framing';

/** The photo couldn't be read (not a photo, or too big to open) or couldn't be saved (the iPad may be full). */
export class PhotoError extends Error {
  constructor(readonly reason: 'unreadable' | 'unsaved') {
    super(reason);
  }
}

/** A decoded photo. `close` lets its file go once the copies are made. */
export interface OpenPhoto {
  image: HTMLImageElement;
  close(): void;
}

/** Decodes a photo the right way up (the iPad follows the camera's note about which way it was held). */
export async function readPhoto(file: Blob): Promise<OpenPhoto> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  const close = () => URL.revokeObjectURL(url);
  try {
    image.src = url;
    await image.decode();
  } catch {
    close();
    throw new PhotoError('unreadable');
  }
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    close();
    throw new PhotoError('unreadable');
  }
  return { image, close };
}

/** Part of an image, drawn at w × h and saved as a JPEG. */
async function jpeg(image: HTMLImageElement, from: Rect, w: number, h: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError('unreadable');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, from.x, from.y, from.w, from.h, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new PhotoError('unreadable');
    return blob;
  } finally {
    // iPads limit the memory all canvases share: give it back straight away.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** The whole photo as it's kept: its long side at most 2000 px. */
export async function wholeCopy(image: HTMLImageElement): Promise<{ blob: Blob; width: number; height: number }> {
  const { naturalWidth: width, naturalHeight: height } = image;
  const size = fitLongSide(width, height);
  return { blob: await jpeg(image, { x: 0, y: 0, w: width, h: height }, size.w, size.h, 0.85), width: size.w, height: size.h };
}

/** The 1600 × 1200 copy the puzzle is cut from, and its thumbnail, for the frame `at`. */
export async function framedCopies(image: HTMLImageElement, at: CropAt): Promise<{ framed: Blob; thumb: Blob }> {
  const crop = cropRect(image.naturalWidth, image.naturalHeight, at);
  return {
    framed: await jpeg(image, crop, FRAMED.w, FRAMED.h, 0.82),
    thumb: await jpeg(image, crop, THUMB.w, THUMB.h, 0.8),
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/photos/shrink.ts
git commit -m "feat: make the kept, framed and thumbnail copies of a family photo"
```

---

### Task 4: The photo picker, and pausing the touch tracker

**Files:**
- Create: `src/photos/picker.ts`
- Modify: `src/frame/games.ts`, `src/frame/frame.ts`

- [ ] **Step 1: Write `src/photos/picker.ts`**

```ts
/**
 * Opens the iPad's photo picker (Photo Library, Take Photo, Choose File). Call it straight from a tap: the iPad only
 * opens it then. Resolves with the chosen photos, or none if the picker was cancelled (older iPads don't say, and
 * then it never resolves, which is harmless: nothing waits on it).
 */
export function pickPhotos(multiple: boolean): Promise<File[]> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = multiple;
  // In the page but out of sight: some iPads won't open a picker for a hidden (display: none) input.
  input.className = 'photo-input';
  document.body.append(input);
  return new Promise((resolve) => {
    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish([...(input.files ?? [])]), { once: true });
    input.addEventListener('cancel', () => finish([]), { once: true });
    input.click();
  });
}
```

Add to `src/styles.css` (at the end):

```css
/* The photo picker's input: in the page (so the iPad opens it) but out of sight. */
.photo-input {
  position: fixed;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 2: Add `cover` to `FrameHost` in `src/frame/games.ts`**

After `updateTargets(targets: GameTargets): void;` add:

```ts
  /**
   * A page of the game's own covers the screen (one with a text box, which needs ordinary taps and the keyboard): the
   * touch tracker stops until the returned function is called.
   */
  cover(): () => void;
```

- [ ] **Step 3: Implement it in `src/frame/frame.ts`**

Add a field after `private settingsOpen = false;`:

```ts
  /** How many of the game's own pages cover the screen (the touch tracker stops while any do). */
  private covered = 0;
```

Add the method after `updateTargets(...)`:

```ts
  cover(): () => void {
    this.covered += 1;
    this.tracer.setEnabled(false);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.covered -= 1;
      this.updateTouchTargets();
    };
  }
```

In `listen()`, change `if (this.settingsOpen) return;` inside `forward` to:

```ts
      if (this.settingsOpen || this.covered > 0) return;
```

At the end of `updateTouchTargets()`, change `this.tracer.setEnabled(!this.settingsOpen);` to:

```ts
    this.tracer.setEnabled(!this.settingsOpen && this.covered === 0);
```

- [ ] **Step 4: Type-check and run all tests**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/photos/picker.ts src/frame/games.ts src/frame/frame.ts src/styles.css
git commit -m "feat: open the iPad's photo picker from a tap; games can pause the touch tracker under a page of their own"
```

---

### Task 5: The Add a photo tile on "Pick a picture"

**Files:**
- Modify: `src/jigsaw/pictures.ts`, `src/jigsaw/picture-page.ts`, `src/ui/icons.ts`, `src/styles.css`
- Test: `tests/jigsaw-pictures.test.ts`

- [ ] **Step 1: Write the failing test** (add to `tests/jigsaw-pictures.test.ts`, inside or after the existing paging `describe`)

```ts
import { PAGE_WITH_ADD } from '../src/jigsaw/pictures';

describe('pages that also hold Add a photo', () => {
  const pictures = Array.from({ length: 12 }, (_, i) => ({ id: `family:p${i}`, src: '', thumb: '', caption: '' }));

  it('have five pictures beside the Add a photo tile', () => {
    expect(PAGE_WITH_ADD).toBe(5);
    expect(picturePage(pictures, 0, PAGE_WITH_ADD).pictures).toHaveLength(5);
    expect(picturePage(pictures, 2, PAGE_WITH_ADD)).toMatchObject({ first: 10, hasBack: true, hasMore: false });
    expect(picturePage(pictures, 2, PAGE_WITH_ADD).pictures.map((p) => p.id)).toEqual(['family:p10', 'family:p11']);
  });
});
```

(Merge the import into the existing `import { loadStarters, parseStarters, picturePage } from '../src/jigsaw/pictures';` line.)

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/jigsaw-pictures.test.ts`
Expected: FAIL, `PAGE_WITH_ADD` is undefined.

- [ ] **Step 3: Add `PAGE_WITH_ADD` to `src/jigsaw/pictures.ts`**

After `export const PAGE_SIZE = 6;` add:

```ts
/** With Add a photo in the first place on every page, five are pictures. */
export const PAGE_WITH_ADD = 5;
```

- [ ] **Step 4: Add the plus icon to `src/ui/icons.ts`**

After `PICTURES_ICON`:

```ts
export const PLUS_ICON = `<svg ${ICON_ATTRS}><path d="M12 5l0 14"/><path d="M5 12l14 0"/></svg>`;
```

- [ ] **Step 5: Draw the tile in `src/jigsaw/picture-page.ts`**

Change the import to `import { CHECK_ICON, PLUS_ICON } from '../ui/icons';`. Add to `PicturePageState`:

```ts
  /** Add a photo comes first on every page (photos can be kept on this iPad). */
  canAdd: boolean;
```

Replace the body from `if (!state.pictures || state.pictures.length === 0) {` down to the end of the `forEach` with:

```ts
  // Add a photo is always in the first place, so it's easy to find again.
  const offset = state.canAdd ? 1 : 0;
  if (state.canAdd) {
    const add = el('div', 'pic-tile pic-add', page);
    add.innerHTML = PLUS_ICON;
    place(add, layout.tiles[0]);
    const caption = el('div', 'pic-caption', page);
    caption.textContent = 'Add a photo';
    place(caption, layout.captions[0]);
  }
  // With nothing to show, a note says why (with Add a photo, an empty list needs none: the family hid the starters).
  if (!state.pictures || (state.pictures.length === 0 && !state.canAdd)) {
    const note = el('div', 'pics-note', page);
    note.textContent = state.pictures ? 'The pictures will be here next time the iPad is on Wi-Fi.' : 'Getting the pictures…';
    const [first, last] = [layout.tiles[offset], layout.tiles[2]];
    place(note, { x: first.x, y: first.y, w: last.x + last.w - first.x, h: first.h });
  }
  (state.pictures ?? []).forEach((picture, i) => {
    const tile = el('div', 'pic-tile', page);
    place(tile, layout.tiles[i + offset]);
    const image = el('img', '', tile);
    image.alt = '';
    image.decoding = 'async';
    image.src = picture.thumb;
    if (state.finished.has(picture.id)) el('span', 'pic-check', tile).innerHTML = CHECK_ICON;
    if (picture.caption) {
      const caption = el('div', 'pic-caption', page);
      caption.textContent = picture.caption;
      place(caption, layout.captions[i + offset]);
    }
  });
```

Also update the function's comment to: `/** Draws "Pick a picture": Add a photo (where photos can be kept), the page's pictures with their captions and checks, and the page's buttons. */`

- [ ] **Step 6: Style the tile and keep line breaks in captions (`src/styles.css`)**

After the `.pic-check svg` rule add:

```css
.pic-tile.pic-add {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px dashed var(--shuffle);
  background: rgba(255, 255, 255, 0.6);
  box-shadow: none;
  color: var(--shuffle);
}

.pic-add svg {
  width: 40%;
  height: 40%;
}
```

In `.pic-caption` and `.jigsaw-caption`, add `white-space: pre-line;` (a family caption may be two typed lines).

- [ ] **Step 7: Pass `canAdd` from `src/jigsaw/screen.ts`** (temporary until Task 8: no photos yet)

In `renderPictures`, add `canAdd: false,` to the state object passed to `renderPicturePage`.

- [ ] **Step 8: Type-check and run the tests**

Run: `npx tsc --noEmit -p . && npx vitest run tests/jigsaw-pictures.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/jigsaw/pictures.ts src/jigsaw/picture-page.ts src/jigsaw/screen.ts src/ui/icons.ts src/styles.css tests/jigsaw-pictures.test.ts
git commit -m "feat: an Add a photo tile first on every page of Pick a picture"
```

---

### Task 6: Forgetting removed photos, and the starter tick box setting

**Files:**
- Modify: `src/jigsaw/storage.ts`, `src/settings/settings.ts`
- Test: `tests/jigsaw-storage.test.ts`, `tests/settings.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/jigsaw-storage.test.ts` (merge `withoutPictures` into its storage import):

```ts
describe('forgetting pictures that are gone', () => {
  const progress = { placed: [], queue: [], tray: [null, null, null], loose: [], positions: [], groups: [], order: [], hints: 0, elapsedMs: 0 };
  const saved = {
    ...freshJigsaw(),
    current: 'family:gone',
    places: [
      { picture: 'family:gone', style: 'tray' as const, count: 9 as const, progress },
      { picture: 'starter:lake', style: 'tray' as const, count: 9 as const, progress },
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
```

(If `freshJigsaw` isn't imported in that file yet, add it to the import.)

In `tests/settings.test.ts`, add `jigsawStarters: true,` to the expected objects in "keeps Mom's iPad as it is" and "gives new iPads a schedule of their own", and `jigsawStarters: false,` to the `saved` object in "loads saved settings". Then add:

```ts
  it('shows the starter pictures unless the family turned them off', () => {
    const store = new MemoryStore();
    store.setItem(SETTINGS_KEY, JSON.stringify({ ...newIpadSettings(), jigsawStarters: 'no' }));
    expect(loadSettings(store).settings.jigsawStarters).toBe(true);
    store.setItem(SETTINGS_KEY, JSON.stringify({ ...newIpadSettings(), jigsawStarters: false }));
    expect(loadSettings(store).settings.jigsawStarters).toBe(false);
  });
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run tests/jigsaw-storage.test.ts tests/settings.test.ts`
Expected: FAIL (`withoutPictures` missing; settings objects lack `jigsawStarters`).

- [ ] **Step 3: Add `withoutPictures` to `src/jigsaw/storage.ts`** (after `withoutPlace`)

```ts
/** Forgets pictures that are gone (removed family photos): their places, their checks, and the puzzle if it was current. */
export function withoutPictures(saved: SavedJigsaw, gone: (picture: string) => boolean): SavedJigsaw {
  return {
    ...saved,
    current: saved.current !== null && gone(saved.current) ? null : saved.current,
    places: saved.places.filter((place) => !gone(place.picture)),
    finished: saved.finished.filter((picture) => !gone(picture)),
  };
}
```

- [ ] **Step 4: Add `jigsawStarters` to `src/settings/settings.ts`**

In `Settings`, after `share: boolean;`:

```ts
  /** Whether Jigsaw offers the starter pictures as well as the family's own photos. */
  jigsawStarters: boolean;
```

In `newIpadSettings()`, after `share: true,` add `jigsawStarters: true,`. In `readSettings`, after the `share` line:

```ts
  if (typeof value.jigsawStarters === 'boolean') settings.jigsawStarters = value.jigsawStarters;
```

- [ ] **Step 5: Run all tests**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/jigsaw/storage.ts src/settings/settings.ts tests/jigsaw-storage.test.ts tests/settings.test.ts
git commit -m "feat: forget removed family photos; a setting to hide the starter pictures"
```

---

### Task 7: The "Your new puzzle" page

**Files:**
- Modify: `src/jigsaw/layout.ts`, `src/styles.css`
- Create: `src/jigsaw/new-photo.ts`
- Test: `tests/jigsaw-layout.test.ts`

- [ ] **Step 1: Write the failing layout test** (add to `tests/jigsaw-layout.test.ts`; merge `computeNewPhotoLayout` into the layout import and add `SCREENS` to the `./screens` import)

```ts
describe.each(SCREENS)('the new photo page on a %ix%i iPad', (width, height) => {
  const layout = computeNewPhotoLayout(width, height);
  const right = [layout.title, layout.captionLabel, layout.caption, layout.confirm, layout.cancel];

  it('has a 4:3 frame inside the photo area, on the left', () => {
    expect(layout.frame.w / layout.frame.h).toBeCloseTo(4 / 3);
    expect(inside(layout.frame, { x: 0, y: 0, w: layout.photoArea.w, h: layout.photoArea.h })).toBe(true);
    expect(layout.frame.w).toBeGreaterThanOrEqual(400);
    for (const rect of right) expect(rect.x).toBeGreaterThanOrEqual(layout.photoArea.x + layout.photoArea.w);
  });

  it('keeps the caption and buttons above the keyboard, on screen and apart', () => {
    for (const rect of right) {
      expect(rect.y + rect.h).toBeLessThanOrEqual(height * 0.45);
      expect(rect.x + rect.w).toBeLessThanOrEqual(width);
    }
    apart(right);
    expect(layout.confirm.h).toBeGreaterThanOrEqual(72);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/jigsaw-layout.test.ts`
Expected: FAIL, `computeNewPhotoLayout` is not a function.

- [ ] **Step 3: Add `computeNewPhotoLayout` to `src/jigsaw/layout.ts`** (at the end)

```ts
/** The new photo page: margins, the right-hand column, and its parts. */
const NEW_MARGIN = 24;
const NEW_COLUMN = 380;
const NEW_TITLE = 56;
const NEW_LABEL = 32;
/** Two lines of 26 px text, with room for the box's padding and border. */
const NEW_CAPTION = 96;
const NEW_BUTTONS = 80;
const NEW_GAP = 16;

export interface NewPhotoLayout {
  /** Where the photo is shown (it's clipped to this); the 4:3 frame sits in its middle, in its coordinates. */
  photoArea: Rect;
  frame: Rect;
  /** Down the right, all in the top part of the screen, as the keyboard covers the bottom half. */
  title: Rect;
  captionLabel: Rect;
  caption: Rect;
  confirm: Rect;
  cancel: Rect;
}

/** "Your new puzzle": the photo on the left, the title, caption box and buttons on the right, top-aligned. */
export function computeNewPhotoLayout(width: number, height: number): NewPhotoLayout {
  const column = Math.min(NEW_COLUMN, width * 0.36);
  const photoArea = { x: NEW_MARGIN, y: NEW_MARGIN, w: width - column - 3 * NEW_MARGIN, h: height - 2 * NEW_MARGIN };
  // A little of the photo shows (dimmed) around the frame, so it's clear the photo can move.
  const room = { x: photoArea.w * 0.08, y: photoArea.h * 0.08, w: photoArea.w * 0.84, h: photoArea.h * 0.84 };
  const x = photoArea.x + photoArea.w + NEW_MARGIN;
  const title = { x, y: NEW_MARGIN, w: column, h: NEW_TITLE };
  const captionLabel = { x, y: title.y + title.h + NEW_GAP, w: column, h: NEW_LABEL };
  const caption = { x, y: captionLabel.y + captionLabel.h + 4, w: column, h: NEW_CAPTION };
  const buttonsY = caption.y + caption.h + NEW_GAP;
  const confirmW = Math.round((column - NEW_GAP) * 0.58);
  return {
    photoArea,
    frame: fit(room, PICTURE_ASPECT),
    title,
    captionLabel,
    caption,
    confirm: { x, y: buttonsY, w: confirmW, h: NEW_BUTTONS },
    cancel: { x: x + confirmW + NEW_GAP, y: buttonsY, w: column - confirmW - NEW_GAP, h: NEW_BUTTONS },
  };
}
```

- [ ] **Step 4: Run the layout tests**

Run: `npx vitest run tests/jigsaw-layout.test.ts`
Expected: PASS at all seven sizes (the column bottom is 24 + 56 + 16 + 32 + 4 + 96 + 16 + 80 = 324 px, under 0.45 × 744 = 335 px on the shortest iPad).

- [ ] **Step 5: Write `src/jigsaw/new-photo.ts`**

```ts
import { el, place } from '../ui/dom';
import { MAX_CAPTION, cleanCaption, dragFrame } from '../photos/framing';
import { cropRect, type CropAt } from './crop';
import { computeNewPhotoLayout } from './layout';

export interface NewPhotoOptions {
  title: string;
  confirmLabel: string;
  /** The caption to start with, or null for no caption box (changing a photo's framing from the settings page). */
  caption: string | null;
  frame: CropAt;
}

export interface NewPhotoChoice {
  frame: CropAt;
  caption: string;
}

/**
 * "Your new puzzle": the photo moves under a fixed 4:3 frame (outside it is dimmed), with a caption box and the
 * buttons on the right. An ordinary page with ordinary taps (the game pauses its touch tracker while it's open).
 * Resolves with the frame and caption, or null on Cancel.
 */
export function openNewPhoto(parent: HTMLElement, image: HTMLImageElement, options: NewPhotoOptions): Promise<NewPhotoChoice | null> {
  return new Promise((resolve) => {
    const page = el('div', 'new-photo', parent);
    const area = el('div', 'new-photo-area', page);
    const shown = el('img', 'new-photo-image', area);
    shown.alt = '';
    shown.draggable = false;
    shown.src = image.src;
    const frameBox = el('div', 'new-photo-frame', area);
    const title = el('h1', 'new-photo-title', page);
    title.textContent = options.title;
    let label: HTMLElement | null = null;
    let caption: HTMLTextAreaElement | null = null;
    if (options.caption !== null) {
      label = el('div', 'new-photo-label', page);
      label.textContent = 'Caption (optional)';
      caption = el('textarea', 'new-photo-caption', page);
      caption.rows = 2;
      caption.maxLength = MAX_CAPTION;
      caption.placeholder = 'Rose and Al, Lake George, 1987';
      caption.value = options.caption;
    }
    const confirm = el('button', 'new-photo-confirm', page);
    confirm.type = 'button';
    confirm.textContent = options.confirmLabel;
    const cancel = el('button', 'new-photo-cancel', page);
    cancel.type = 'button';
    cancel.textContent = 'Cancel';

    const { naturalWidth: width, naturalHeight: height } = image;
    let at: CropAt = { ...options.frame };
    let layout = computeNewPhotoLayout(window.innerWidth, window.innerHeight);
    const scale = () => layout.frame.w / cropRect(width, height, at).w;
    const draw = () => {
      layout = computeNewPhotoLayout(window.innerWidth, window.innerHeight);
      place(area, layout.photoArea);
      place(frameBox, layout.frame);
      place(title, layout.title);
      if (label) place(label, layout.captionLabel);
      if (caption) place(caption, layout.caption);
      place(confirm, layout.confirm);
      place(cancel, layout.cancel);
      // The photo sits so that the part in the frame lines up with it.
      const crop = cropRect(width, height, at);
      const s = scale();
      place(shown, { x: layout.frame.x - crop.x * s, y: layout.frame.y - crop.y * s, w: width * s, h: height * s });
    };

    // The newest finger on the photo moves it (a thumb that was already resting doesn't).
    let drag: { id: number; x: number; y: number; at: CropAt } | null = null;
    area.addEventListener('pointerdown', (event) => {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, at };
      caption?.blur();
    });
    area.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const s = layout.frame.w / cropRect(width, height, drag.at).w;
      at = dragFrame(drag.at, width, height, s, event.clientX - drag.x, event.clientY - drag.y);
      draw();
    });
    const lift = (event: PointerEvent) => {
      if (drag?.id === event.pointerId) drag = null;
    };
    area.addEventListener('pointerup', lift);
    area.addEventListener('pointercancel', lift);

    const close = (choice: NewPhotoChoice | null) => {
      caption?.blur();
      window.removeEventListener('resize', draw);
      page.remove();
      resolve(choice);
    };
    confirm.addEventListener('click', () => close({ frame: at, caption: cleanCaption(caption?.value ?? '') }));
    cancel.addEventListener('click', () => close(null));
    window.addEventListener('resize', draw);
    draw();
  });
}
```

- [ ] **Step 6: Style it (`src/styles.css`, at the end)**

```css
/* "Your new puzzle" / "Change framing": an ordinary page over the game or the settings page. */
.new-photo {
  position: fixed;
  inset: 0;
  z-index: 55;
  background: var(--bg);
  touch-action: none;
}

.new-photo-area {
  position: absolute;
  overflow: hidden;
  border-radius: 14px;
  background: #222;
}

.new-photo-image {
  position: absolute;
  max-width: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* The frame: clear inside, the rest of the photo dimmed (its shadow is clipped by the area). */
.new-photo-frame {
  position: absolute;
  box-sizing: border-box;
  border: 4px solid #fff;
  box-shadow: 0 0 0 4000px rgba(20, 20, 20, 0.55);
  pointer-events: none;
}

.new-photo-title {
  position: absolute;
  margin: 0;
  display: flex;
  align-items: center;
  font-size: 36px;
  color: var(--navy);
}

.new-photo-label {
  position: absolute;
  font-size: 22px;
  color: var(--label);
}

.new-photo-caption {
  position: absolute;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 3px solid var(--slot-border);
  border-radius: 12px;
  font: inherit;
  font-size: 26px;
  line-height: 34px;
  resize: none;
  color: var(--ink);
  background: #fff;
}

.new-photo-confirm,
.new-photo-cancel {
  position: absolute;
  border-radius: 16px;
  font: inherit;
  font-size: 28px;
  cursor: pointer;
}

.new-photo-confirm {
  border: 4px solid var(--found-ink);
  background: var(--found);
  color: #fff;
}

.new-photo-cancel {
  border: 4px solid var(--navy);
  background: #fff;
  color: var(--navy);
}
```

- [ ] **Step 7: Type-check and run all tests**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/jigsaw/layout.ts src/jigsaw/new-photo.ts src/styles.css tests/jigsaw-layout.test.ts
git commit -m "feat: the Your new puzzle page: move the photo under a 4:3 frame and caption it"
```

---

### Task 8: Adding a photo in the game

**Files:**
- Create: `src/photos/adder.ts`
- Modify: `src/jigsaw/screen.ts`, `src/main.ts`

- [ ] **Step 1: Write `src/photos/adder.ts`**

```ts
import { START_CROP } from '../jigsaw/crop';
import { openNewPhoto } from '../jigsaw/new-photo';
import type { Picture } from '../jigsaw/types';
import { familyPicture } from './family';
import { newPhotoId } from './framing';
import { pickPhotos } from './picker';
import { PhotoError, framedCopies, readPhoto, wholeCopy } from './shrink';
import type { FamilyPhoto, PhotoStore } from './store';

/** Adding a family photo from the game. */
export interface PhotoAdder {
  /** Opens the iPad's photo picker. Call it straight from her tap. Resolves with her photo, or null. */
  pick(): Promise<Blob | null>;
  /** "Your new puzzle" for the photo, then saves it. Resolves with its picture, or null on Cancel. Rejects with a PhotoError. */
  create(file: Blob): Promise<Picture | null>;
}

/** `parent` is where "Your new puzzle" opens (over the game). */
export function photoAdder(parent: HTMLElement, photos: PhotoStore): PhotoAdder {
  return {
    // pickPhotos runs before the first await, so the picker still opens straight from the tap.
    pick: async () => (await pickPhotos(false))[0] ?? null,
    async create(file) {
      const opened = await readPhoto(file);
      try {
        const choice = await openNewPhoto(parent, opened.image, { title: 'Your new puzzle', confirmLabel: 'Start puzzle', caption: '', frame: START_CROP });
        if (!choice) return null;
        const whole = await wholeCopy(opened.image);
        const copies = await framedCopies(opened.image, choice.frame);
        const now = Date.now();
        const photo: FamilyPhoto = {
          id: newPhotoId(now),
          added: now,
          caption: choice.caption,
          frame: choice.frame,
          whole: whole.blob,
          width: whole.width,
          height: whole.height,
          ...copies,
        };
        try {
          await photos.put(photo);
        } catch {
          throw new PhotoError('unsaved');
        }
        return familyPicture(photo, (blob) => URL.createObjectURL(blob));
      } finally {
        opened.close();
      }
    },
  };
}
```

- [ ] **Step 2: Change Jigsaw's options and picture loading in `src/jigsaw/screen.ts`**

Imports to add:

```ts
import type { NoticeCard } from '../frame/view';
import type { PhotoAdder } from '../photos/adder';
import { FAMILY, type PictureList } from '../photos/family';
import { PhotoError } from '../photos/shrink';
import { PICTURES_ICON } from '../ui/icons';
```

(Add `PAGE_SIZE, PAGE_WITH_ADD` to the existing `./pictures` import and `withoutPictures` to the `./storage` import. `./view` in this file is Jigsaw's own view; `NoticeCard` comes from the frame's, `../frame/view`.)

Replace `JigsawOptions` with:

```ts
export interface JigsawOptions {
  /** The pictures she can choose from, and which family photos there are. */
  loadPictures: () => Promise<PictureList>;
  /** Adding a family photo; null where photos can't be kept (no Add a photo tile). */
  photos?: PhotoAdder | null;
  /** The current time; tests can pass a fixed one. */
  now?: () => Date;
}

/** What she's told when a photo can't be added. */
const photoProblem = (error: unknown): NoticeCard =>
  error instanceof PhotoError && error.reason === 'unsaved'
    ? { icon: PICTURES_ICON, title: "That photo couldn't be saved", lines: ['The iPad may be full.'] }
    : { icon: PICTURES_ICON, title: "That photo can't be used", lines: ['Try another one.'] };
```

Replace `picturesLoaded` with:

```ts
  private picturesLoaded({ pictures, family }: PictureList): void {
    this.pictures = pictures;
    // Family photos removed on the settings page: their places and checks go too (only when the photos could be read).
    if (family) {
      this.saved = withoutPictures(this.saved, (id) => id.startsWith(FAMILY) && !family.includes(id));
      saveSavedJigsaw(this.store, this.saved);
    }
    const current = this.saved.current;
    if (!current && !this.picture) this.mode = 'pictures';
    if (current && !this.picture) {
      this.picture = pictures.find((p) => p.id === current) ?? null;
      if (!this.picture) {
        this.mode = 'pictures';
        // Its picture is gone from the site: back to choosing. (With no list at all, offline, she keeps her place.)
        if (pictures.length > 0) {
          this.saved = { ...this.saved, current: null };
          saveSavedJigsaw(this.store, this.saved);
        }
      }
    }
    this.redrawWhenFree();
  }
```

- [ ] **Step 3: Pages with the Add a photo tile (`src/jigsaw/screen.ts`)**

Add a helper method:

```ts
  /** Pictures per page: five beside Add a photo, or six where photos can't be kept. */
  private perPage(): number {
    return this.options.photos ? PAGE_WITH_ADD : PAGE_SIZE;
  }
```

In `renderPictures`, change `picturePage(this.pictures ?? [], this.page)` to `picturePage(this.pictures ?? [], this.page, this.perPage())`, change `canAdd: false,` (from Task 5) to `canAdd: this.options.photos != null,` and replace the buttons line:

```ts
    const offset = this.options.photos ? 1 : 0;
    const buttons: ButtonGeometry[] = page.pictures.map((_, i) => ({ id: `pic:${i}`, ...layout.tiles[i + offset] }));
    if (offset) buttons.unshift({ id: 'pic:add', ...layout.tiles[0] });
```

- [ ] **Step 4: The Add a photo flow (`src/jigsaw/screen.ts`)**

In `buttonTapped`, before the `id.startsWith('pic:')` line, add:

```ts
    if (id === 'pic:add') return this.addPhoto();
```

Split `openPicture` into two (the body after finding the picture moves into `startPicture`):

```ts
  private openPicture(index: number): void {
    const picture = picturePage(this.pictures ?? [], this.page, this.perPage()).pictures[index];
    if (picture) this.startPicture(picture);
  }

  /** Starts `picture` in her style and piece count, or picks up where she left off in it. */
  private startPicture(picture: Picture): void {
    this.save();
    this.picture = picture;
    this.game = null;
    this.lifted = null;
    // Only the picture on screen is kept decoded: a 1600 × 1200 photo takes several MB.
    for (const src of [...this.images.keys()]) if (src !== picture.src) this.images.delete(src);
    this.saved = { ...this.saved, current: picture.id };
    this.mode = 'puzzle';
    this.host.redraw(true);
    this.timer.resume(performance.now());
    this.resetIdle();
  }

  /** Add a photo: the iPad's picker, then "Your new puzzle"; Start puzzle starts it straight away. */
  private addPhoto(): void {
    const photos = this.options.photos;
    if (!photos || this.mode !== 'pictures') return;
    void photos.pick().then(async (file) => {
      if (!file) return;
      const uncover = this.host.cover();
      try {
        const picture = await photos.create(file);
        if (!picture) return;
        // Newest first, ahead of every other picture.
        this.pictures = [picture, ...(this.pictures ?? [])];
        this.startPicture(picture);
      } catch (error) {
        this.host.notice(photoProblem(error));
      } finally {
        uncover();
      }
    });
  }
```

(`buttonTapped` returns `void`; `return this.addPhoto();` keeps the early exit on one line like the surrounding code. If the linter objects to returning a void call, write `this.addPhoto(); return;` on two lines instead.)

- [ ] **Step 5: Wire it up in `src/main.ts`**

Imports to add:

```ts
import { photoAdder } from './photos/adder';
import { loadPictureList } from './photos/family';
import { openPhotoStore } from './photos/store';
```

After `const store = window.localStorage;`:

```ts
/** The family's photos for Jigsaw, in this app's own IndexedDB database; null where it can't keep them. */
const photoStore = openPhotoStore();
```

Replace the `jigsaw:` maker with:

```ts
    jigsaw: () =>
      new JigsawScreen(store, {
        loadPictures: () =>
          loadPictureList(photoStore, settings.jigsawStarters ? () => loadStarters(import.meta.env.BASE_URL) : async () => []),
        photos: photoStore && photoAdder(root!, photoStore),
      }),
```

- [ ] **Step 6: Type-check, run all tests, build**

Run: `npx tsc --noEmit -p . && npx vitest run && npm run build`
Expected: PASS, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/photos/adder.ts src/jigsaw/screen.ts src/main.ts
git commit -m "feat: Add a photo in Jigsaw: the picker, Your new puzzle, and the photo saved on the iPad"
```

---

### Task 9: Check adding a photo in the browser and the iPad Simulator

**Checkpoint: the owner tries it, including adding a photo.**

- [ ] **Step 1: Browser pane (desktop file chooser stands in for the iPad picker)**

Start the worktree preview (see the memory note on previewing a worktree: a temporary `jigsaw-worktree` entry in the main checkout's `.claude/launch.json` on port 5175, removed afterwards with `git checkout -- .claude/launch.json`). At 1024 × 768:
- "Pick a picture" shows Add a photo first (dashed purple, big +), then five pictures; More pictures appears with 6+ pictures.
- Tap Add a photo: the file chooser opens. Choose a JPEG landscape photo and a tall one (copy two from `photos/starter/`).
- "Your new puzzle": photo on the left with the white 4:3 frame, outside dimmed; dragging moves the photo, and the frame never leaves it; the tall photo only moves up and down. Caption box with the gray example; typing works; Cancel adds nothing.
- Start puzzle: the puzzle starts with the framed part; after finishing (Hint to the end), the caption shows under the photo (two typed lines stay two lines). The new photo is first on "Pick a picture" with its check.
- Reload: the photo is still there (IndexedDB). Tiles, captions and puzzle look right.
- Console: no errors.

- [ ] **Step 2: iPad Simulator** (boot it in the background early, it's slow from cold)

Serve with `--host 0.0.0.0` (or use the Simulator's Safari on `http://127.0.0.1:5175`, which reaches this Mac). In Safari on the Simulator:
- Tap Add a photo: the iPad's own menu (Photo Library / Take Photo / Choose File) opens. **This is the key check** that a tap through the touch tracker can open the picker.
- Pick a photo from the Simulator's library: it comes in the right way up; the keyboard leaves the caption box and buttons visible.
- If the picker does **not** open from the tracker's tap: make the Add a photo tile a real file input. In `picture-page.ts`, inside the `canAdd` branch, add `const input = el('input', 'pic-add-input', add); input.type = 'file'; input.accept = 'image/*';` with CSS `.pic-add-input { position: absolute; inset: 0; opacity: 0; }`, pass its chosen file to Jigsaw through a new `PicturePageState.photoChosen(file)` callback, and stop registering `pic:add` with the touch tracker. Commit that as its own fix with the Simulator result in the message.

- [ ] **Step 3: Owner checkpoint**

Show the owner the browser pane; ask them to add a photo of their own and try Cancel, framing, a two-line caption and finishing the puzzle. Note anything they want changed before the settings section.

---

### Task 10: Shared settings controls

**Files:**
- Create: `src/settings/controls.ts`
- Modify: `src/settings/page.ts`

- [ ] **Step 1: Move `section`, `button` and `checkbox` from `page.ts` into `src/settings/controls.ts`**

```ts
import { el } from '../ui/dom';

/** A settings section with its heading. */
export function section(parent: HTMLElement, title: string): HTMLElement {
  const box = el('section', 'settings-section', parent);
  el('h2', '', box).textContent = title;
  return box;
}

export function button(parent: HTMLElement, text: string, onClick: () => void, className = 'settings-button'): HTMLButtonElement {
  const node = el('button', className, parent);
  node.type = 'button';
  node.textContent = text;
  node.addEventListener('click', onClick);
  return node;
}

export function checkbox(parent: HTMLElement, label: string, checked: boolean, onChange: (box: HTMLInputElement) => void): HTMLInputElement {
  const row = el('label', 'settings-check', parent);
  const box = el('input', '', row);
  box.type = 'checkbox';
  box.checked = checked;
  row.append(label);
  box.addEventListener('change', () => onChange(box));
  return box;
}
```

In `page.ts`, delete those three functions and add `import { button, checkbox, section } from './controls';`.

- [ ] **Step 2: Type-check and run all tests**

Run: `npx tsc --noEmit -p . && npx vitest run`
Expected: PASS (no behavior change).

- [ ] **Step 3: Commit**

```bash
git add src/settings/controls.ts src/settings/page.ts
git commit -m "refactor: settings controls in their own file, for the Jigsaw pictures section"
```

---

### Task 11: The "Jigsaw pictures" settings section

**Files:**
- Create: `src/settings/jigsaw-pictures.ts`
- Modify: `src/settings/page.ts`, `src/main.ts`, `src/styles.css`

- [ ] **Step 1: Write `src/settings/jigsaw-pictures.ts`**

```ts
import { START_CROP } from '../jigsaw/crop';
import { openNewPhoto } from '../jigsaw/new-photo';
import { MAX_CAPTION, cleanCaption, newPhotoId } from '../photos/framing';
import { pickPhotos } from '../photos/picker';
import { framedCopies, readPhoto, wholeCopy, type OpenPhoto } from '../photos/shrink';
import type { FamilyPhoto, PhotoStore } from '../photos/store';
import { el } from '../ui/dom';
import { button, checkbox } from './controls';
import type { Settings } from './settings';

/** A caption is saved this long after the last key, not on every letter. */
const CAPTION_SAVE_MS = 500;

/** One photo, kept whole with its framed copy and thumbnail. Throws if it can't be read or saved. */
async function addOne(photos: PhotoStore, file: File, added: number): Promise<void> {
  const opened = await readPhoto(file);
  try {
    const whole = await wholeCopy(opened.image);
    const copies = await framedCopies(opened.image, START_CROP);
    await photos.put({ id: newPhotoId(added), added, caption: '', frame: { ...START_CROP }, whole: whole.blob, width: whole.width, height: whole.height, ...copies });
  } finally {
    opened.close();
  }
}

/**
 * "Jigsaw pictures" on the settings page, folded. Photo changes are saved straight away (Cancel doesn't undo them);
 * the starter tick box is part of the settings and applies on Done. `cover` is where Change framing opens.
 */
export function renderJigsawPictures(sheet: HTMLElement, cover: HTMLElement, photos: PhotoStore | null, draft: Settings): void {
  const box = el('details', 'settings-section settings-photos', sheet);
  el('summary', '', box).textContent = 'Jigsaw pictures';
  checkbox(box, 'Show the starter pictures', draft.jigsawStarters, (input) => (draft.jigsawStarters = input.checked));
  if (!photos) {
    el('p', 'settings-note', box).textContent = 'Photos can’t be kept in this browser. Open Word Circle from the Home Screen to add them.';
    return;
  }
  el('p', 'settings-note', box).textContent = 'Photos from this iPad become puzzles. They stay on this iPad and are never sent anywhere.';
  const status = el('p', 'settings-note', box);
  const list = el('ul', 'settings-photo-list', box);
  let urls: string[] = [];
  let flushes: Array<() => void> = [];

  const render = async (): Promise<void> => {
    for (const flush of flushes) flush();
    flushes = [];
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    list.replaceChildren();
    let saved: FamilyPhoto[];
    try {
      saved = await photos.list();
    } catch {
      status.textContent = 'The photos can’t be read right now.';
      return;
    }
    if (saved.length === 0) el('li', 'settings-empty', list).textContent = 'No photos yet';
    for (const photo of saved) row(photo);
  };

  const row = (photo: FamilyPhoto): void => {
    let latest = photo;
    const item = el('li', 'settings-photo', list);
    const thumb = el('img', 'settings-photo-thumb', item);
    thumb.alt = '';
    const url = URL.createObjectURL(photo.thumb);
    urls.push(url);
    thumb.src = url;
    const side = el('div', 'settings-photo-side', item);
    const caption = el('textarea', 'settings-input', side);
    caption.rows = 2;
    caption.maxLength = MAX_CAPTION;
    caption.placeholder = 'Caption (optional), e.g. Rose and Al, Lake George, 1987';
    caption.value = photo.caption;
    let timer = 0;
    const saveCaption = () => {
      window.clearTimeout(timer);
      const text = cleanCaption(caption.value);
      if (text === latest.caption) return;
      latest = { ...latest, caption: text };
      void photos.put(latest).catch(() => (status.textContent = 'That caption couldn’t be saved. The iPad may be full.'));
    };
    caption.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(saveCaption, CAPTION_SAVE_MS);
    });
    caption.addEventListener('blur', saveCaption);
    flushes.push(saveCaption);

    const actions = el('div', 'settings-photo-actions', side);
    button(actions, 'Change framing', async () => {
      saveCaption();
      let opened: OpenPhoto;
      try {
        opened = await readPhoto(latest.whole);
      } catch {
        status.textContent = 'That photo can’t be opened.';
        return;
      }
      try {
        const choice = await openNewPhoto(cover, opened.image, { title: 'Change framing', confirmLabel: 'Save', caption: null, frame: latest.frame });
        if (!choice) return;
        latest = { ...latest, frame: choice.frame, ...(await framedCopies(opened.image, choice.frame)) };
        await photos.put(latest);
        await render();
      } catch {
        status.textContent = 'The new framing couldn’t be saved. The iPad may be full.';
      } finally {
        opened.close();
      }
    });
    const remove = button(actions, 'Remove', () => {
      actions.replaceChildren();
      el('span', 'settings-photo-ask', actions).textContent = 'Remove this picture from Jigsaw? It stays in Photos.';
      button(actions, 'Remove', async () => {
        try {
          await photos.remove(latest.id);
        } catch {
          status.textContent = 'That photo couldn’t be removed.';
        }
        await render();
      });
      button(actions, 'Keep', () => void render());
    });
    remove.classList.add('settings-remove');
  };

  button(box, 'Add photos', () => {
    // Straight from the tap, so the iPad opens its picker.
    void pickPhotos(true).then(async (files) => {
      if (files.length === 0) return;
      status.textContent = files.length === 1 ? 'Adding the photo…' : `Adding ${files.length} photos…`;
      let failed = 0;
      // One at a time (the iPad has little memory for big photos), newest last so the list keeps their order.
      for (const [i, file] of files.entries()) {
        try {
          await addOne(photos, file, Date.now() + i);
        } catch {
          failed += 1;
        }
      }
      const added = files.length - failed;
      status.textContent =
        failed === 0
          ? `${added === 1 ? 'The photo was' : `${added} photos were`} added.`
          : `${added} added. ${failed === 1 ? 'One photo' : `${failed} photos`} couldn’t be used (or the iPad is full).`;
      await render();
    });
  });
  // Add photos sits above the list.
  box.insertBefore(box.lastElementChild!, status);
  void render();
}
```

- [ ] **Step 2: Add the section to the settings page (`src/settings/page.ts`)**

Import `renderJigsawPictures` from `./jigsaw-pictures` and `type PhotoStore` from `../photos/store`. Add to `SettingsPageOptions`:

```ts
  /** The family's photos for Jigsaw; null where they can't be kept. */
  photos: PhotoStore | null;
```

After the "Words to avoid" section (before `const keep = el('details', ...)`), add:

```ts
  renderJigsawPictures(sheet, page, options.photos, draft);
```

(`page` is the settings page element: Change framing opens inside it, so its taps count as activity and the page doesn't close itself as idle.)

- [ ] **Step 3: Pass the store in, and reload after Cancel if photos changed (`src/main.ts`)**

Import `trackChanges` with `openPhotoStore`. Change `showSettings` to take the photos:

```ts
function showSettings(
  settings: Settings,
  firstTime: boolean,
  family: FamilyStats | null,
  photos: PhotoStore | null,
  done: (next: Settings) => void,
  cancel: () => void,
): void {
  settingsShowing = true;
  openSettingsPage(root!, settings, {
    firstTime,
    family,
    photos,
    done: (next) => {
      settingsShowing = false;
      done(next);
    },
    cancel: () => {
      settingsShowing = false;
      cancel();
    },
  });
}
```

(Import `type PhotoStore` from `./photos/store`.) In `startApp`'s `openSettings`, wrap the store so Cancel can tell whether the photos changed:

```ts
    openSettings: (closed) => {
      const watched = photoStore && trackChanges(photoStore);
      showSettings(
        settings,
        false,
        familyStats(loadLog(store), dayKey(new Date()), loadLifetime(store).since),
        watched?.store ?? null,
        (next) => {
          saveSettings(store, next);
          // Everything is saved after every move, so she loses nothing; the app comes back built from the new settings.
          window.location.reload();
        },
        // Photos are saved as they're changed, so Cancel still brings the game up to date with them.
        () => (watched?.changed() ? window.location.reload() : closed()),
      );
    },
```

In `firstSetup`, pass `photoStore` as the new fourth argument (`showSettings(settings, true, null, photoStore, ...)`).

- [ ] **Step 4: Style the rows (`src/styles.css`, after the other `.settings-` rules)**

```css
.settings-photo-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.settings-photo {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 12px 0;
  border-top: 1px solid var(--grid-line);
}

.settings-photo-thumb {
  width: 160px;
  height: 120px;
  flex: none;
  border-radius: 8px;
  object-fit: cover;
}

.settings-photo-side {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.settings-photo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.settings-photo-ask {
  font-weight: 700;
}

.settings-remove {
  color: #a32020;
}
```

- [ ] **Step 5: Type-check, run all tests, build**

Run: `npx tsc --noEmit -p . && npx vitest run && npm run build`
Expected: PASS, build succeeds.

- [ ] **Step 6: Check in the browser**

Hold the clock 3 s to open settings. In "Jigsaw pictures": Add photos (choose two), both appear newest first with their thumbnails; type a caption, wait, Cancel → the app reloads and the caption shows under the tile in Jigsaw; Change framing opens the framing page over settings (no caption box), Save updates the thumbnail; Remove asks first, Keep keeps it, Remove removes it and its tile goes from Jigsaw (and its check and saved places: the current puzzle, if it was this one, goes back to Pick a picture); untick "Show the starter pictures", Done → only family photos and Add a photo show. Console has no errors.

- [ ] **Step 7: Commit**

```bash
git add src/settings/jigsaw-pictures.ts src/settings/page.ts src/main.ts src/styles.css
git commit -m "feat: Jigsaw pictures on the settings page: add several, captions, framing, remove, hide the starters"
```

---

### Task 12: Spec, review and finish

- [ ] **Step 1: Update the spec** (`docs/superpowers/specs/2026-10-28-jigsaw-design.md`)

- §3 picture page: "Under each picture, its caption on up to two lines, cut short with "…" past that"; the Add a photo tile appears only where photos can be kept (otherwise six pictures a page).
- §3 adding: the game pauses the frame's touch tracker with `FrameHost.cover()` while "Your new puzzle" is open; the photo moves under a fixed frame; family captions keep a typed line break.
- §3 where family photos live: each photo also keeps a framed 1600 × 1200 copy, so the game treats it like a starter picture.
- §5: removed photos are forgotten by Jigsaw when its picture list loads (only when the photos could be read).
- Mark §7 steps 3–4 built, with the date.

- [ ] **Step 2: Full check**

Run: `npx tsc --noEmit -p . && npx vitest run && npm run build`
Expected: all pass.

- [ ] **Step 3: Review**

Dispatch `superpowers:code-reviewer` (model: sonnet) on the part 2 commits against this plan and the spec; fix what it finds, then re-run Step 2.

- [ ] **Step 4: Commit the spec update**

```bash
git add docs/superpowers/specs/2026-10-28-jigsaw-design.md
git commit -m "docs: Jigsaw spec updated for family photos as built"
```

- [ ] **Step 5: Hand back to the owner** for the second checkpoint (adding photos in the game and on the settings page), then use superpowers:finishing-a-development-branch. Ask before pushing.
