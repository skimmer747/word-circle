import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { PAGE_WITH_ADD, loadStarters, parseStarters, picturePage, pictureShown } from '../src/jigsaw/pictures';
import type { Picture } from '../src/jigsaw/types';

describe('the starter pictures', () => {
  it('reads the published list, with full addresses', () => {
    expect(parseStarters([{ id: 'lake', file: 'lake.jpg', thumb: 'lake.thumb.jpg', caption: ' Lake Louise ' }], '/word-circle/')).toEqual([
      { id: 'starter:lake', src: '/word-circle/jigsaw/lake.jpg', thumb: '/word-circle/jigsaw/lake.thumb.jpg', caption: 'Lake Louise' },
    ]);
  });

  it('leaves out anything damaged or repeated', () => {
    const list = [
      { id: 'Bad Id', file: 'a.jpg', thumb: 'a.thumb.jpg' },
      { id: 'a', file: 3, thumb: 'a.thumb.jpg' },
      { id: 'c1', file: '', thumb: 'c1.thumb.jpg' },
      { id: 'c2', file: '../x.jpg', thumb: 'c2.thumb.jpg' },
      { id: 'c3', file: 'https://x/y.jpg', thumb: 'c3.thumb.jpg' },
      { id: 'c4', file: 'c4.jpg', thumb: 'a b.jpg' },
      null,
      { id: 'b', file: 'b.jpg', thumb: 'b.thumb.jpg' },
      { id: 'b', file: 'b2.jpg', thumb: 'b2.thumb.jpg' },
    ];
    expect(parseStarters(list, '/')).toEqual([{ id: 'starter:b', src: '/jigsaw/b.jpg', thumb: '/jigsaw/b.thumb.jpg', caption: '' }]);
    expect(parseStarters({ not: 'a list' }, '/')).toEqual([]);
  });

  it('reads the drawing of a starter that has one', () => {
    const entry = { id: 'lake', file: 'lake.jpg', thumb: 'lake.thumb.jpg', cartoon: 'lake.cartoon.png', cartoonThumb: 'lake.cartoon.thumb.png', caption: '' };
    expect(parseStarters([entry], '/word-circle/')[0].cartoon).toEqual({
      src: '/word-circle/jigsaw/lake.cartoon.png',
      thumb: '/word-circle/jigsaw/lake.cartoon.thumb.png',
    });
  });

  it('keeps the photo when its drawing is damaged', () => {
    const photo = { file: 'a.jpg', thumb: 'a.thumb.jpg', caption: '' };
    const list = [
      { id: 'a1', ...photo, cartoon: '../x.png', cartoonThumb: 'a.cartoon.thumb.png' },
      { id: 'a2', ...photo, cartoon: 'a.cartoon.png', cartoonThumb: 7 },
      { id: 'a3', ...photo, cartoon: 'a.cartoon.png' },
    ];
    const pictures = parseStarters(list, '/');
    expect(pictures.map((p) => p.id)).toEqual(['starter:a1', 'starter:a2', 'starter:a3']);
    expect(pictures.every((p) => !('cartoon' in p))).toBe(true);
  });

  it("fetches the list, and has none when it can't", async () => {
    const list = JSON.stringify([{ id: 'a', file: 'a.jpg', thumb: 'a.thumb.jpg', caption: '' }]);
    const asked: string[] = [];
    const found = await loadStarters('/word-circle/', async (url) => {
      asked.push(url);
      return new Response(list);
    });
    expect(found.map((p) => p.id)).toEqual(['starter:a']);
    expect(asked).toEqual(['/word-circle/jigsaw/starters.json']);
    expect(await loadStarters('/', async () => new Response('', { status: 404 }))).toEqual([]);
    expect(await loadStarters('/', async () => new Response('not json'))).toEqual([]);
    expect(
      await loadStarters('/', async () => {
        throw new Error('offline');
      }),
    ).toEqual([]);
  });

  it('uses the browser fetch when no fetcher is given', async () => {
    const stub = vi.fn(async () => new Response('[]'));
    vi.stubGlobal('fetch', stub);
    try {
      expect(await loadStarters('/')).toEqual([]);
      expect(stub).toHaveBeenCalledWith('/jigsaw/starters.json');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('a picture as shown, photo or drawing', () => {
  const photo: Picture = { id: 'family:x', src: 'x.jpg', thumb: 'x.thumb.jpg', caption: 'X' };
  const drawn: Picture = { id: 'starter:lake', src: 'lake.jpg', thumb: 'lake.thumb.jpg', caption: 'Lake', cartoon: { src: 'lake.cartoon.png', thumb: 'lake.cartoon.thumb.png' } };

  it('is the photo while Cartoons is off', () => {
    expect(pictureShown(drawn, false)).toBe(drawn);
  });

  it('is the drawing while Cartoons is on, still the same picture', () => {
    expect(pictureShown(drawn, true)).toEqual({ ...drawn, src: 'lake.cartoon.png', thumb: 'lake.cartoon.thumb.png' });
  });

  it('stays the photo when there is no drawing', () => {
    expect(pictureShown(photo, true)).toBe(photo);
  });
});

describe('the published starters.json and the parser agree', () => {
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const raw = JSON.parse(readFileSync(new URL('../public/jigsaw/starters.json', import.meta.url), 'utf8')) as unknown[];

  it('the parser keeps every entry of public/jigsaw/starters.json', () => {
    expect(raw.length).toBeGreaterThan(0);
    expect(parseStarters(raw, '/word-circle/')).toHaveLength(raw.length);
  });

  it('every picture and thumbnail the parser keeps, and every drawing, is a file under public/', () => {
    for (const picture of parseStarters(raw, '/word-circle/')) {
      for (const address of [picture.src, picture.thumb, picture.cartoon?.src, picture.cartoon?.thumb].filter((a) => a !== undefined)) {
        const file = join(publicDir, address.slice('/word-circle/'.length));
        expect(existsSync(file), address).toBe(true);
      }
    }
  });
});

describe('pages of pictures', () => {
  const pictures: Picture[] = Array.from({ length: 14 }, (_, i) => ({ id: `starter:p${i}`, src: '', thumb: '', caption: '' }));

  it('shows six at a time, with Back and More where there are more', () => {
    expect(picturePage(pictures, 0)).toMatchObject({ first: 0, hasBack: false, hasMore: true });
    expect(picturePage(pictures, 0).pictures).toHaveLength(6);
    expect(picturePage(pictures, 2)).toMatchObject({ first: 12, hasBack: true, hasMore: false });
    expect(picturePage(pictures, 2).pictures.map((p) => p.id)).toEqual(['starter:p12', 'starter:p13']);
  });

  it('keeps the page inside the list', () => {
    expect(picturePage(pictures, 9).first).toBe(12);
    expect(picturePage(pictures, 9).page).toBe(2);
    expect(picturePage(pictures, -1).first).toBe(0);
    expect(picturePage([], 0)).toEqual({ pictures: [], page: 0, first: 0, hasBack: false, hasMore: false });
  });

  it('reads odd page numbers as whole pages', () => {
    expect(picturePage(pictures, NaN).page).toBe(0);
    expect(picturePage(pictures, 1.5)).toMatchObject({ page: 1, first: 6 });
  });

  it('keeps full pages whole at the edges of the list', () => {
    const twelve = pictures.slice(0, 12);
    expect(picturePage(twelve, 1)).toMatchObject({ first: 6, hasMore: false });
    expect(picturePage(twelve, 1).pictures).toHaveLength(6);
    const six = pictures.slice(0, 6);
    expect(picturePage(six, 0)).toMatchObject({ hasBack: false, hasMore: false });
    expect(picturePage(six, 0).pictures).toHaveLength(6);
  });

  it('fits fewer pictures on a page that also holds Add a photo', () => {
    expect(picturePage(pictures, 0, 5).pictures).toHaveLength(5);
    expect(picturePage(pictures, 2, 5)).toMatchObject({ first: 10, hasMore: false });
  });

  it('has five pictures beside the Add a photo tile', () => {
    expect(PAGE_WITH_ADD).toBe(5);
    expect(picturePage(pictures, 2, PAGE_WITH_ADD).pictures.map((p) => p.id)).toEqual(['starter:p10', 'starter:p11', 'starter:p12', 'starter:p13']);
  });
});
