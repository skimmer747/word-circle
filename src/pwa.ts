import { registerSW } from 'virtual:pwa-register';
import type { Updates } from './frame/frame';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Applies new versions only before she has touched anything, or between puzzles. */
export function setupUpdates(hasInteracted: () => boolean): Updates {
  let pending = false;
  const updateSW = registerSW({
    onNeedRefresh() {
      if (hasInteracted()) pending = true;
      else void updateSW(true);
    },
    onRegisteredSW(_url, registration) {
      if (registration) window.setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
  });
  return {
    applyIfPending() {
      if (!pending) return false;
      void updateSW(true);
      return true;
    },
  };
}
