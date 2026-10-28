import { MAX_CAPTION, cleanCaption, dragFrame } from '../photos/framing';
import { el, place } from '../ui/dom';
import { cropRect, type CropAt } from './crop';
import { computeNewPhotoLayout } from './layout';

export interface NewPhotoOptions {
  title: string;
  confirmLabel: string;
  /** The caption to start with, or null for no caption box (changing a photo's framing from the settings page). */
  caption: string | null;
  frame: CropAt;
}

export interface NewPhotoChoice {
  frame: CropAt;
  caption: string;
}

/**
 * "Your new puzzle": the photo moves under a fixed 4:3 frame (outside it is dimmed), with a caption box and the
 * buttons on the right. An ordinary page with ordinary taps (the game pauses its touch tracker while it's open).
 * Resolves with the frame and caption, or null on Cancel.
 */
export function openNewPhoto(parent: HTMLElement, image: HTMLImageElement, options: NewPhotoOptions): Promise<NewPhotoChoice | null> {
  return new Promise((resolve) => {
    const page = el('div', 'new-photo', parent);
    const area = el('div', 'new-photo-area', page);
    const shown = el('img', 'new-photo-image', area);
    shown.alt = '';
    shown.draggable = false;
    shown.src = image.src;
    const frameBox = el('div', 'new-photo-frame', area);
    const title = el('h1', 'new-photo-title', page);
    title.textContent = options.title;
    let label: HTMLElement | null = null;
    let caption: HTMLTextAreaElement | null = null;
    if (options.caption !== null) {
      label = el('div', 'new-photo-label', page);
      label.textContent = 'Caption (optional)';
      caption = el('textarea', 'new-photo-caption', page);
      caption.rows = 2;
      caption.maxLength = MAX_CAPTION;
      caption.placeholder = 'Rose and Al, Lake George, 1987';
      caption.value = options.caption;
    }
    const confirm = el('button', 'new-photo-confirm', page);
    confirm.type = 'button';
    confirm.textContent = options.confirmLabel;
    const cancel = el('button', 'new-photo-cancel', page);
    cancel.type = 'button';
    cancel.textContent = 'Cancel';

    const { naturalWidth: width, naturalHeight: height } = image;
    let at: CropAt = { ...options.frame };
    let layout = computeNewPhotoLayout(window.innerWidth, window.innerHeight);
    const draw = () => {
      layout = computeNewPhotoLayout(window.innerWidth, window.innerHeight);
      place(area, layout.photoArea);
      place(frameBox, layout.frame);
      place(title, layout.title);
      if (label) place(label, layout.captionLabel);
      if (caption) place(caption, layout.caption);
      place(confirm, layout.confirm);
      place(cancel, layout.cancel);
      // The photo sits so that the part in the frame lines up with it.
      const crop = cropRect(width, height, at);
      const scale = layout.frame.w / crop.w;
      place(shown, { x: layout.frame.x - crop.x * scale, y: layout.frame.y - crop.y * scale, w: width * scale, h: height * scale });
    };

    // The newest finger on the photo moves it (a thumb that was already resting doesn't).
    let drag: { id: number; x: number; y: number; at: CropAt } | null = null;
    area.addEventListener('pointerdown', (event) => {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, at };
      caption?.blur();
    });
    area.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const scale = layout.frame.w / cropRect(width, height, drag.at).w;
      at = dragFrame(drag.at, width, height, scale, event.clientX - drag.x, event.clientY - drag.y);
      draw();
    });
    const lift = (event: PointerEvent) => {
      if (drag?.id === event.pointerId) drag = null;
    };
    area.addEventListener('pointerup', lift);
    area.addEventListener('pointercancel', lift);

    const close = (choice: NewPhotoChoice | null) => {
      caption?.blur();
      window.removeEventListener('resize', draw);
      page.remove();
      resolve(choice);
    };
    confirm.addEventListener('click', () => close({ frame: at, caption: cleanCaption(caption?.value ?? '') }));
    cancel.addEventListener('click', () => close(null));
    window.addEventListener('resize', draw);
    draw();
  });
}
