import { describe, expect, it } from 'vitest';
import { loadStarters, parseStarters, picturePage } from '../src/jigsaw/pictures';
import type { Picture } from '../src/jigsaw/types';

describe('the starter pictures', () => {
  it('reads the published list, with full addresses', () => {
    expect(parseStarters([{ id: 'lake', file: 'lake.jpg', thumb: 'lake-thumb.jpg', caption: ' Lake Louise ' }], '/word-circle/')).toEqual([
      { id: 'starter:lake', src: '/word-circle/jigsaw/lake.jpg', thumb: '/word-circle/jigsaw/lake-thumb.jpg', caption: 'Lake Louise' },
    ]);
  });

  it('leaves out anything damaged or repeated', () => {
    const list = [
      { id: 'Bad Id', file: 'a.jpg', thumb: 'a-thumb.jpg' },
      { id: 'a', file: 3, thumb: 'a-thumb.jpg' },
      null,
      { id: 'b', file: 'b.jpg', thumb: 'b-thumb.jpg' },
      { id: 'b', file: 'b2.jpg', thumb: 'b2-thumb.jpg' },
    ];
    expect(parseStarters(list, '/')).toEqual([{ id: 'starter:b', src: '/jigsaw/b.jpg', thumb: '/jigsaw/b-thumb.jpg', caption: '' }]);
    expect(parseStarters({ not: 'a list' }, '/')).toEqual([]);
  });

  it("fetches the list, and has none when it can't", async () => {
    const list = JSON.stringify([{ id: 'a', file: 'a.jpg', thumb: 'a-thumb.jpg', caption: '' }]);
    expect((await loadStarters('/', async () => new Response(list))).map((p) => p.id)).toEqual(['starter:a']);
    expect(await loadStarters('/', async () => new Response('', { status: 404 }))).toEqual([]);
    expect(
      await loadStarters('/', async () => {
        throw new Error('offline');
      }),
    ).toEqual([]);
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
    expect(picturePage(pictures, -1).first).toBe(0);
    expect(picturePage([], 0)).toEqual({ pictures: [], first: 0, hasBack: false, hasMore: false });
  });

  it('fits fewer pictures on a page that also holds Add a photo', () => {
    expect(picturePage(pictures, 0, 5).pictures).toHaveLength(5);
    expect(picturePage(pictures, 2, 5)).toMatchObject({ first: 10, hasMore: false });
  });
});
