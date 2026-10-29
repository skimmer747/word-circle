import { el, place } from '../ui/dom';
import { CHECK_ICON, PLUS_ICON } from '../ui/icons';
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
  /** Add a photo comes first on every page (photos can be kept on this iPad). */
  canAdd: boolean;
  /** Cartoons on or off, or null for no Cartoons button (no picture has a drawing). */
  cartoons: boolean | null;
}

function button(parent: HTMLElement, className: string, label: string, rect: PicturePageLayout['back']): void {
  const b = el('button', className, parent);
  b.type = 'button';
  b.textContent = label;
  place(b, rect);
}

/** Draws "Pick a picture": Cartoons (where there are drawings), Add a photo (where photos can be kept), the page's pictures with their captions and checks, and the page's buttons. */
export function renderPicturePage(layer: HTMLElement, layout: PicturePageLayout, state: PicturePageState, animateIn: boolean): void {
  const page = document.createElement('div');
  page.className = 'board pics';
  layer.replaceChildren(page);
  const title = el('div', 'pics-title', page);
  title.textContent = 'Pick a picture';
  place(title, layout.title);
  // The puzzle's Cartoon button, in the same look: a check when it's on.
  if (state.cartoons !== null) {
    const cartoons = el('button', state.cartoons ? 'level on' : 'level', page);
    cartoons.type = 'button';
    cartoons.innerHTML = `${state.cartoons ? CHECK_ICON : ''}<span>Cartoons</span>`;
    place(cartoons, layout.cartoons);
  }

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
  if (state.hasBack) button(page, 'button pics-back', '‹ Back', layout.back);
  if (state.canClose) button(page, 'button pics-close', 'Close', layout.close);
  if (state.hasMore) button(page, 'button pics-more', 'More pictures ›', layout.more);

  if (animateIn) {
    page.classList.add('entering');
    void page.offsetWidth;
    page.classList.remove('entering');
  }
}
