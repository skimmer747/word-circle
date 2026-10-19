import { shuffle } from '../shared/random';

/** Ring slot i shows letter order[i]. */
export function identityOrder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/** A new circle order whose letters read differently from the current one. */
export function shuffleRing(order: readonly number[], letters: readonly string[], random: () => number): number[] {
  const spelled = (o: readonly number[]) => o.map((i) => letters[i]).join('');
  const current = spelled(order);
  let next = shuffle(order, random);
  for (let attempt = 0; attempt < 20 && spelled(next) === current; attempt++) {
    next = shuffle(order, random);
  }
  return next;
}
