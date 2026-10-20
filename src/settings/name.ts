/** The longest name kept, so "Well done, …!" still fits on the card. */
export const MAX_NAME_LENGTH = 16;

/** A name as typed, tidied: no spaces at the ends or doubled, at most MAX_NAME_LENGTH characters (an emoji counts as one). */
export function cleanName(text: string): string {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, MAX_NAME_LENGTH).join('').trim();
}

/** The "Well done!" card's title. */
export function wellDoneTitle(name: string): string {
  return name ? `Well done, ${name}!` : 'Well done!';
}
