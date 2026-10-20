import type { Rect } from '../frame/layout';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

export function place(node: HTMLElement, rect: Rect): void {
  node.style.left = `${rect.x}px`;
  node.style.top = `${rect.y}px`;
  node.style.width = `${rect.w}px`;
  node.style.height = `${rect.h}px`;
}

/** Plays a CSS animation again from the start. */
export function restartAnimation(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

/** True when the iPad is set to Reduce Motion. */
export function reduceMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
