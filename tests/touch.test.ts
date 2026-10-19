import { describe, expect, it } from 'vitest';
import { LetterTracer, type PointerInput, type TracerGeometry } from '../src/input/touch';

const GEOMETRY: TracerGeometry = {
  screenWidth: 1180,
  safeZoneWidth: 130,
  tiles: [
    { x: 600, y: 300, r: 50 },
    { x: 720, y: 300, r: 50 },
    { x: 840, y: 300, r: 50 },
    { x: 720, y: 450, r: 50 },
  ],
};

function setup() {
  const events: string[] = [];
  const tracer = new LetterTracer({
    letterAdded: (tile) => events.push(`add ${tile}`),
    letterRemoved: (tile) => events.push(`remove ${tile}`),
    wordSubmitted: (tiles) => events.push(`submit ${tiles.join(',')}`),
    selectionCleared: () => events.push('clear'),
  });
  tracer.setGeometry(GEOMETRY);
  const send = (type: PointerInput['type'], id: number, x: number, y: number) => tracer.handle({ type, id, x, y });
  const at = (i: number) => [GEOMETRY.tiles[i].x, GEOMETRY.tiles[i].y] as const;
  return { tracer, events, send, at };
}

describe('LetterTracer', () => {
  it('traces a word across three letters and submits it on lift', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('up', 1, ...at(2));
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'submit 0,1,2']);
  });

  it('ignores a touch that starts in the left safe zone, even when it slides onto letters', () => {
    const { events, send, at } = setup();
    send('down', 1, 60, 300);
    send('move', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('up', 1, ...at(2));
    expect(events).toEqual([]);
  });

  it('ignores a touch that starts in the right safe zone', () => {
    const { events, send, at } = setup();
    send('down', 1, 1120, 300);
    send('move', 1, ...at(2));
    send('up', 1, ...at(2));
    expect(events).toEqual([]);
  });

  it('lets her finger play while her thumb rests in the safe zone', () => {
    const { events, send, at } = setup();
    send('down', 1, 60, 500);
    send('down', 2, ...at(0));
    send('move', 2, ...at(1));
    send('move', 1, 70, 510);
    send('move', 2, ...at(2));
    send('up', 2, ...at(2));
    send('up', 1, 70, 510);
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'submit 0,1,2']);
  });

  it('does nothing when a touch starts on the background', () => {
    const { events, send, at } = setup();
    send('down', 1, 400, 600);
    send('move', 1, ...at(0));
    send('move', 1, ...at(1));
    send('up', 1, ...at(1));
    expect(events).toEqual([]);
  });

  it('starts a word from just outside a letter edge', () => {
    const { events, send } = setup();
    send('down', 1, 655, 300);
    expect(events).toEqual(['add 0']);
  });

  it('only adds a letter while sliding when the finger is on its tile', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, 665, 300);
    expect(events).toEqual(['add 0']);
  });

  it('ignores a second finger while a word is being traced', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('down', 2, ...at(1));
    send('move', 2, ...at(2));
    send('move', 1, ...at(1));
    send('move', 1, ...at(3));
    send('up', 2, ...at(2));
    send('up', 1, ...at(3));
    expect(events).toEqual(['add 0', 'add 1', 'add 3', 'submit 0,1,3']);
  });

  it('removes the last letter when sliding back onto the previous one', () => {
    const { tracer, events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('move', 1, ...at(1));
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'remove 2']);
    expect(tracer.selection).toEqual([0, 1]);
  });

  it('ignores sliding onto an earlier letter that is not the previous one', () => {
    const { tracer, events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('move', 1, ...at(0));
    expect(events).toEqual(['add 0', 'add 1', 'add 2']);
    expect(tracer.selection).toEqual([0, 1, 2]);
  });

  it('does not repeat a letter while the finger stays on it', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, 605, 305);
    send('move', 1, 598, 296);
    expect(events).toEqual(['add 0']);
  });

  it('keeps the word when the finger wanders off the circle', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('move', 1, 1150, 700);
    send('up', 1, 1150, 700);
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'submit 0,1,2']);
  });

  it('clears silently when lifted after fewer than three letters', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('up', 1, ...at(1));
    expect(events).toEqual(['add 0', 'add 1', 'clear']);
  });

  it('clears without submitting when the touch is cancelled', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('cancel', 1, ...at(2));
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'clear']);
  });

  it('ignores touches while disabled and drops a word in progress', () => {
    const { tracer, events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    tracer.setEnabled(false);
    send('move', 1, ...at(2));
    send('up', 1, ...at(2));
    send('down', 2, ...at(0));
    expect(events).toEqual(['add 0', 'add 1']);
    tracer.setEnabled(true);
    send('down', 3, ...at(3));
    expect(events).toEqual(['add 0', 'add 1', 'add 3']);
  });

  it('reports whether a word is being traced', () => {
    const { tracer, send, at } = setup();
    expect(tracer.isTracing).toBe(false);
    send('down', 1, ...at(0));
    expect(tracer.isTracing).toBe(true);
    send('up', 1, ...at(0));
    expect(tracer.isTracing).toBe(false);
  });
});
