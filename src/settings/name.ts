/** The longest name kept, so "Well done, …!" still fits on the card. */
export const MAX_NAME_LENGTH = 16;

/** A name as typed, tidied: no spaces at the ends or doubled, at most MAX_NAME_LENGTH characters. */
export function cleanName(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
}

/** "Good morning, Ruth" (afternoon from noon, evening from 5 PM until 5 AM); '' without a name. */
export function greeting(name: string, hour: number): string {
  if (!name) return '';
  const part = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name}`;
}

/** The "Well done!" card's title. */
export function wellDoneTitle(name: string): string {
  return name ? `Well done, ${name}!` : 'Well done!';
}
