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
