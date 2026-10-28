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
