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
    el('p', 'settings-note', box).textContent = "Photos can't be kept in this browser. Open Word Circle from the Home Screen to add them.";
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
      status.textContent = "The photos can't be read right now.";
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
      void photos.put(latest).catch(() => (status.textContent = "That caption couldn't be saved. The iPad may be full."));
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
        status.textContent = "That photo can't be opened.";
        return;
      }
      try {
        const choice = await openNewPhoto(cover, opened.image, { title: 'Change framing', confirmLabel: 'Save', caption: null, frame: latest.frame });
        if (!choice) return;
        latest = { ...latest, frame: choice.frame, ...(await framedCopies(opened.image, choice.frame)) };
        await photos.put(latest);
        await render();
      } catch {
        status.textContent = "The new framing couldn't be saved. The iPad may be full.";
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
          status.textContent = "That photo couldn't be removed.";
        }
        await render();
      });
      button(actions, 'Keep', () => void render());
    });
    remove.classList.add('settings-remove');
  };

  const add = button(box, 'Add photos', () => {
    // Straight from the tap, so the iPad opens its picker.
    void pickPhotos(true).then(async (files) => {
      if (files.length === 0) return;
      status.textContent = files.length === 1 ? 'Adding the photo…' : `Adding ${files.length} photos…`;
      let failed = 0;
      // One at a time (the iPad has little memory for big photos), each a moment newer than the last so none tie.
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
      await render();
    });
  });
  // Add photos sits above the list.
  box.insertBefore(add, status);
  void render();
}
