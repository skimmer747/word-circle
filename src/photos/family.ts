import type { Picture } from '../jigsaw/types';
import type { FamilyPhoto, PhotoStore } from './store';

/** Family photos' picture ids start with this; the rest is the photo's id. */
export const FAMILY = 'family:';

/** What "Pick a picture" lists, and the family photos' picture ids (null if they couldn't be read). */
export interface PictureList {
  pictures: Picture[];
  family: string[] | null;
}

/** A family photo as one of Jigsaw's pictures. `url` gives an address for a stored image. */
export function familyPicture(photo: FamilyPhoto, url: (blob: Blob) => string): Picture {
  return { id: `${FAMILY}${photo.id}`, src: url(photo.framed), thumb: url(photo.thumb), caption: photo.caption };
}

/** Family photos newest first, then the starter pictures (`starters` gives none when the family hides them). */
export async function loadPictureList(
  photos: PhotoStore | null,
  starters: () => Promise<Picture[]>,
  url: (blob: Blob) => string = (blob) => URL.createObjectURL(blob),
): Promise<PictureList> {
  const [family, shown] = await Promise.all([photos ? photos.list().catch(() => null) : Promise.resolve([]), starters()]);
  const pictures = (family ?? []).map((photo) => familyPicture(photo, url));
  return { pictures: [...pictures, ...shown], family: family ? pictures.map((picture) => picture.id) : null };
}
