import { el, place } from '../ui/dom';
import { CHECK_ICON } from '../ui/icons';
import type { PicturePageLayout } from './layout';
import type { Picture } from './types';

export interface PicturePageState {
  /** This page's pictures, or null while the list is still loading. */
  pictures: readonly Picture[] | null;
  /** Pictures she has finished, which get a green check. */
  finished: ReadonlySet<string>;
  hasBack: boolean;
  hasMore: boolean;
  /** She opened the page in the middle of a puzzle: Close goes back to it. */
  canClose: boolean;
}

function button(parent: HTMLElement, className: string, label: string, rect: PicturePageLayout['back']): void {
  const b = el('button', className, parent);
  b.type = 'button';
  b.textContent = label;
  place(b, rect);
}

/** Draws "Pick a picture": up to six pictures with their captions and checks, and the page's buttons. */
export function renderPicturePage(layer: HTMLElement, layout: PicturePageLayout, state: PicturePageState, animateIn: boolean): void {
  const page = document.createElement('div');
  page.className = 'board pics';
  layer.replaceChildren(page);
  const title = el('div', 'pics-title', page);
  title.textContent = 'Pick a picture';
  place(title, layout.title);

  if (!state.pictures || state.pictures.length === 0) {
    const note = el('div', 'pics-note', page);
    note.textContent = state.pictures ? 'The pictures will be here next time the iPad is on Wi-Fi.' : 'Getting the pictures…';
    const [first, third] = [layout.tiles[0], layout.tiles[2]];
    place(note, { x: first.x, y: first.y, w: third.x + third.w - first.x, h: first.h });
  }
  (state.pictures ?? []).forEach((picture, i) => {
    const tile = el('div', 'pic-tile', page);
    place(tile, layout.tiles[i]);
    const image = el('img', '', tile);
    image.alt = '';
    image.decoding = 'async';
    image.src = picture.thumb;
    if (state.finished.has(picture.id)) el('span', 'pic-check', tile).innerHTML = CHECK_ICON;
    if (picture.caption) {
      const caption = el('div', 'pic-caption', page);
      caption.textContent = picture.caption;
      place(caption, layout.captions[i]);
    }
  });
  if (state.hasBack) button(page, 'button pics-back', '‹ Back', layout.back);
  if (state.canClose) button(page, 'button pics-close', 'Close', layout.close);
  if (state.hasMore) button(page, 'button pics-more', 'More pictures ›', layout.more);

  if (animateIn) {
    page.classList.add('entering');
    void page.offsetWidth;
    page.classList.remove('entering');
  }
}
