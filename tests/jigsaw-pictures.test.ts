import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { PAGE_WITH_ADD, loadStarters, parseStarters, picturePage } from '../src/jigsaw/pictures';
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

describe('the published starters.json and the parser agree', () => {
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const raw = JSON.parse(readFileSync(new URL('../public/jigsaw/starters.json', import.meta.url), 'utf8')) as unknown[];

  it('the parser keeps every entry of public/jigsaw/starters.json', () => {
    expect(raw.length).toBeGreaterThan(0);
    expect(parseStarters(raw, '/word-circle/')).toHaveLength(raw.length);
  });

  it('every picture and thumbnail the parser keeps is a file under public/', () => {
    for (const picture of parseStarters(raw, '/word-circle/')) {
      for (const address of [picture.src, picture.thumb]) {
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
