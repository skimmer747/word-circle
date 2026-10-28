import { el } from '../ui/dom';

/** A settings section with its heading. */
export function section(parent: HTMLElement, title: string): HTMLElement {
  const box = el('section', 'settings-section', parent);
  el('h2', '', box).textContent = title;
  return box;
}

export function button(parent: HTMLElement, text: string, onClick: () => void, className = 'settings-button'): HTMLButtonElement {
  const node = el('button', className, parent);
  node.type = 'button';
  node.textContent = text;
  node.addEventListener('click', onClick);
  return node;
}

export function checkbox(parent: HTMLElement, label: string, checked: boolean, onChange: (box: HTMLInputElement) => void): HTMLInputElement {
  const row = el('label', 'settings-check', parent);
  const box = el('input', '', row);
  box.type = 'checkbox';
  box.checked = checked;
  row.append(label);
  box.addEventListener('change', () => onChange(box));
  return box;
}
