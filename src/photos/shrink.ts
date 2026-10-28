import type { Rect } from '../frame/layout';
import { cropRect, type CropAt } from '../jigsaw/crop';
import { FRAMED, THUMB, fitLongSide } from './framing';

/** The photo couldn't be read (not a photo, or too big to open) or couldn't be saved (the iPad may be full). */
export class PhotoError extends Error {
  constructor(readonly reason: 'unreadable' | 'unsaved') {
    super(reason);
  }
}

/** A decoded photo. `close` lets its file go once the copies are made. */
export interface OpenPhoto {
  image: HTMLImageElement;
  close(): void;
}

/** Decodes a photo the right way up (the iPad follows the camera's note about which way it was held). */
export async function readPhoto(file: Blob): Promise<OpenPhoto> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  const close = () => URL.revokeObjectURL(url);
  try {
    image.src = url;
    await image.decode();
  } catch {
    close();
    throw new PhotoError('unreadable');
  }
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    close();
    throw new PhotoError('unreadable');
  }
  return { image, close };
}

/** Part of an image, drawn at w × h and saved as a JPEG. */
async function jpeg(image: HTMLImageElement, from: Rect, w: number, h: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError('unreadable');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, from.x, from.y, from.w, from.h, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new PhotoError('unreadable');
    return blob;
  } finally {
    // iPads limit the memory all canvases share: give it back straight away.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** The whole photo as it's kept: its long side at most 2000 px. */
export async function wholeCopy(image: HTMLImageElement): Promise<{ blob: Blob; width: number; height: number }> {
  const { naturalWidth: width, naturalHeight: height } = image;
  const size = fitLongSide(width, height);
  return { blob: await jpeg(image, { x: 0, y: 0, w: width, h: height }, size.w, size.h, 0.85), width: size.w, height: size.h };
}

/** The 1600 × 1200 copy the puzzle is cut from, and its thumbnail, for the frame `at`. */
export async function framedCopies(image: HTMLImageElement, at: CropAt): Promise<{ framed: Blob; thumb: Blob }> {
  const crop = cropRect(image.naturalWidth, image.naturalHeight, at);
  return {
    framed: await jpeg(image, crop, FRAMED.w, FRAMED.h, 0.82),
    thumb: await jpeg(image, crop, THUMB.w, THUMB.h, 0.8),
  };
}
