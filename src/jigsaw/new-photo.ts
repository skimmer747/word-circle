import { MAX_CAPTION, cleanCaption, dragFrame, fitLongSide, maxZoom, pinchFrame } from '../photos/framing';
import { el, place } from '../ui/dom';
import { cropRect, zoomOf, type CropAt } from './crop';
import { computeNewPhotoLayout } from './layout';
import type { Point } from './types';

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

/** A finger down this long without moving, when another comes down, is a resting thumb: it's left out. */
const REST_MS = 1000;
/** A finger that has moved this far isn't resting. */
const MOVE_PX = 10;

const middle = (points: readonly Point[]): Point => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
const apart = (points: readonly Point[]): number => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

interface Finger {
  now: Point;
  start: Point;
  /** When it came down (event time). */
  down: number;
  moved: boolean;
  resting: boolean;
}

/**
 * "Your new puzzle": the photo moves under a fixed 4:3 frame (outside it is dimmed) and pinches to zoom, with a caption
 * box and the buttons on the right. An ordinary page with ordinary taps (the game pauses its touch tracker while it's open).
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
    // The rest of the photo is dimmed by four panels around the frame (a frame-sized hole in one big shadow isn't drawn
    // by every browser).
    const dims = [0, 1, 2, 3].map(() => el('div', 'new-photo-dim', area));
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
    const tip = el('div', 'new-photo-tip', page);
    tip.textContent = 'Drag the photo to move it. Pinch to zoom in or out.';

    const { naturalWidth: width, naturalHeight: height } = image;
    let at: CropAt = { ...options.frame };
    let layout = computeNewPhotoLayout(window.innerWidth, window.innerHeight);
    const draw = () => {
      layout = computeNewPhotoLayout(window.innerWidth, window.innerHeight);
      place(area, layout.photoArea);
      place(frameBox, layout.frame);
      const { frame: f, photoArea: a } = layout;
      const below = f.y + f.h;
      const right = f.x + f.w;
      place(dims[0], { x: 0, y: 0, w: a.w, h: f.y });
      place(dims[1], { x: 0, y: below, w: a.w, h: a.h - below });
      place(dims[2], { x: 0, y: f.y, w: f.x, h: f.h });
      place(dims[3], { x: right, y: f.y, w: a.w - right, h: f.h });
      place(title, layout.title);
      if (label) place(label, layout.captionLabel);
      if (caption) place(caption, layout.caption);
      place(confirm, layout.confirm);
      place(cancel, layout.cancel);
      place(tip, layout.tip);
      // The photo sits so that the part in the frame lines up with it.
      const crop = cropRect(width, height, at);
      const scale = layout.frame.w / crop.w;
      place(shown, { x: layout.frame.x - crop.x * scale, y: layout.frame.y - crop.y * scale, w: width * scale, h: height * scale });
    };

    // Zoomed in no further than the copy that's kept allows (it may be smaller than the photo shown here, and Change
    // framing cuts from it later), or than it already was.
    const kept = fitLongSide(width, height);
    const most = Math.max(maxZoom(kept.w, kept.h), zoomOf(options.frame));
    /** Where an event is on the photo area (the frame's coordinates). */
    const local = (event: { clientX: number; clientY: number }): Point => ({
      x: event.clientX - layout.photoArea.x,
      y: event.clientY - layout.photoArea.y,
    });

    // Fingers on the photo: one drags it, two pinch to zoom. A thumb already resting there is left out, so it doesn't
    // turn every drag into a pinch. Each time a finger comes or goes, the move starts again from where things are.
    const fingers = new Map<number, Finger>();
    let gesture: { at: CropAt; from: Map<number, Point> } | null = null;
    const restart = () => {
      const active = [...fingers].filter(([, finger]) => !finger.resting).slice(-2);
      gesture = active.length > 0 ? { at, from: new Map(active.map(([id, finger]) => [id, finger.now])) } : null;
    };
    area.addEventListener('pointerdown', (event) => {
      for (const finger of fingers.values()) if (!finger.moved && event.timeStamp - finger.down > REST_MS) finger.resting = true;
      const point = local(event);
      fingers.set(event.pointerId, { now: point, start: point, down: event.timeStamp, moved: false, resting: false });
      try {
        area.setPointerCapture(event.pointerId);
      } catch {
        // Only a pointer the browser knows about can be captured; the move still works without it.
      }
      caption?.blur();
      restart();
    });
    area.addEventListener('pointermove', (event) => {
      const finger = fingers.get(event.pointerId);
      if (!finger) return;
      finger.now = local(event);
      if (Math.hypot(finger.now.x - finger.start.x, finger.now.y - finger.start.y) > MOVE_PX) finger.moved = true;
      if (!gesture?.from.has(event.pointerId)) return;
      const ids = [...gesture.from.keys()];
      const then = ids.map((id) => gesture!.from.get(id)!);
      const now = ids.map((id) => fingers.get(id)!.now);
      if (ids.length === 1) {
        const scale = layout.frame.w / cropRect(width, height, gesture.at).w;
        at = dragFrame(gesture.at, width, height, scale, now[0].x - then[0].x, now[0].y - then[0].y);
      } else {
        at = pinchFrame(gesture.at, width, height, layout.frame, middle(then), apart(then), middle(now), apart(now), most);
      }
      draw();
    });
    const lift = (event: PointerEvent) => {
      if (fingers.delete(event.pointerId)) restart();
    };
    area.addEventListener('pointerup', lift);
    area.addEventListener('pointercancel', lift);

    // A trackpad pinch on a Mac, for trying it out there: Safari sends gesture events, other browsers a wheel with Ctrl.
    // (On an iPad the fingers above do it, so gesture events are ignored while fingers are down.)
    let trackpad: { at: CropAt; mid: Point } | null = null;
    area.addEventListener('gesturestart', (event) => {
      event.preventDefault();
      if (fingers.size === 0) trackpad = { at, mid: local(event as unknown as MouseEvent) };
    });
    area.addEventListener('gesturechange', (event) => {
      event.preventDefault();
      if (!trackpad || fingers.size > 0) return;
      const spread = (event as unknown as { scale: number }).scale;
      at = pinchFrame(trackpad.at, width, height, layout.frame, trackpad.mid, 1, trackpad.mid, spread, most);
      draw();
    });
    area.addEventListener('gestureend', () => (trackpad = null));
    area.addEventListener(
      'wheel',
      (event) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        const mid = local(event);
        at = pinchFrame(at, width, height, layout.frame, mid, 1, mid, Math.exp(-event.deltaY / 100), most);
        draw();
      },
      { passive: false },
    );

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
