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

/** The section, for the settings page: Done and Cancel wait for `settle`. */
export interface JigsawPicturesSection {
  /** Saves captions still being typed and finishes saves and adds under way (Done may reload the app straight after). */
  settle(): Promise<void>;
}

/**
 * "Jigsaw pictures" on the settings page, folded. Photo changes are saved straight away (Cancel doesn't undo them);
 * the starter tick box is part of the settings and applies on Done. `cover` is where Change framing opens.
 */
export function renderJigsawPictures(sheet: HTMLElement, cover: HTMLElement, photos: PhotoStore | null, draft: Settings): JigsawPicturesSection {
  const box = el('details', 'settings-section settings-photos', sheet);
  el('summary', '', box).textContent = 'Jigsaw pictures';
  if (!photos) {
    // No tick box here: with the starters hidden and no photos, Jigsaw would have nothing to show.
    el('p', 'settings-note', box).textContent = "Photos can't be kept in this browser. Open Word Circle from the Home Screen to add them.";
    return { settle: async () => {} };
  }
  checkbox(box, 'Show the starter pictures', draft.jigsawStarters, (input) => (draft.jigsawStarters = input.checked));
  el('p', 'settings-note', box).textContent = 'Photos from this iPad become puzzles. They stay on this iPad and are never sent anywhere.';
  const status = el('p', 'settings-note', box);
  const list = el('ul', 'settings-photo-list', box);
  let urls: string[] = [];
  let flushes: Array<() => void> = [];
  /** Saves and adds under way. */
  const pending = new Set<Promise<unknown>>();
  const track = <T>(work: Promise<T>): Promise<T> => {
    pending.add(work);
    const done = () => pending.delete(work);
    work.then(done, done);
    return work;
  };
  /** Only the newest list is drawn, if two are asked for at once (a double tap). */
  let generation = 0;

  const render = async (): Promise<void> => {
    const mine = ++generation;
    for (const flush of flushes) flush();
    let saved: FamilyPhoto[];
    try {
      saved = await photos.list();
    } catch {
      if (mine === generation) status.textContent = "The photos can't be read right now.";
      return;
    }
    if (mine !== generation) return;
    flushes = [];
    for (const url of urls) URL.revokeObjectURL(url);
    urls = [];
    list.replaceChildren();
    if (saved.length === 0) el('li', 'settings-empty', list).textContent = 'No photos yet';
    for (const photo of saved) row(photo);
  };

  const row = (photo: FamilyPhoto): void => {
    let latest = photo;
    /** Set once she confirms Remove: nothing saves it again. */
    let removed = false;
    /** Change framing is open (a second tap waits). */
    let framing = false;
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
      if (removed || text === latest.caption) return;
      latest = { ...latest, caption: text };
      void track(photos.put(latest)).catch(() => (status.textContent = "That caption couldn't be saved. The iPad may be full."));
    };
    caption.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(saveCaption, CAPTION_SAVE_MS);
    });
    caption.addEventListener('blur', saveCaption);
    flushes.push(saveCaption);

    const actions = el('div', 'settings-photo-actions', side);
    button(actions, 'Change framing', async () => {
      if (framing || removed) return;
      framing = true;
      status.textContent = '';
      saveCaption();
      let opened: OpenPhoto;
      try {
        opened = await readPhoto(latest.whole);
      } catch {
        status.textContent = "That photo can't be opened.";
        framing = false;
        return;
      }
      try {
        const choice = await openNewPhoto(cover, opened.image, { title: 'Change framing', confirmLabel: 'Save', caption: null, frame: latest.frame });
        if (!choice) return;
        let copies: { framed: Blob; thumb: Blob };
        try {
          copies = await framedCopies(opened.image, choice.frame);
        } catch {
          status.textContent = "The new framing couldn't be made. Try again.";
          return;
        }
        latest = { ...latest, frame: choice.frame, ...copies };
        try {
          await track(photos.put(latest));
        } catch {
          status.textContent = "The new framing couldn't be saved. The iPad may be full.";
          return;
        }
        await render();
      } finally {
        opened.close();
        framing = false;
      }
    });
    const remove = button(actions, 'Remove', () => {
      status.textContent = '';
      // What she typed is kept if she changes her mind; the box is locked while she decides.
      saveCaption();
      caption.disabled = true;
      actions.replaceChildren();
      el('span', 'settings-photo-ask', actions).textContent = 'Remove this picture from Jigsaw? It stays in Photos.';
      button(actions, 'Remove', async () => {
        if (removed) return;
        removed = true;
        window.clearTimeout(timer);
        try {
          await track(photos.remove(latest.id));
        } catch {
          status.textContent = "That photo couldn't be removed.";
        }
        await render();
      });
      button(actions, 'Keep', () => void render());
    });
    remove.classList.add('settings-remove');
  };

  let adding = false;
  /** Several photos, one at a time (the iPad has little memory for big photos), each a moment newer so none tie. */
  const addAll = async (files: File[]): Promise<void> => {
    adding = true;
    status.textContent = files.length === 1 ? 'Adding the photo…' : `Adding ${files.length} photos…`;
    let failed = 0;
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
        : `${added} added. ${failed === 1 ? 'One photo' : `${failed} photos`} couldn't be used (or the iPad is full).`;
    adding = false;
    await render();
  };
  const add = button(box, 'Add photos', () => {
    if (adding) return;
    // Straight from the tap, so the iPad opens its picker.
    void pickPhotos(true).then((files) => {
      if (files.length > 0 && !adding) void track(addAll(files));
    });
  });
  // Add photos sits above the list.
  box.insertBefore(add, status);
  void render();

  return {
    async settle() {
      for (const flush of flushes) flush();
      // A save can start another (a re-framing saves, then redraws): wait until nothing is left.
      while (pending.size > 0) await Promise.allSettled([...pending]);
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
    },
  };
}
