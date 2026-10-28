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
