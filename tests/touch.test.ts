import { describe, expect, it } from 'vitest';
import { LetterTracer, type PointerInput, type TracerGeometry } from '../src/input/touch';

const GEOMETRY: TracerGeometry = {
  screenWidth: 1180,
  safeZoneLeft: 200,
  safeZoneRight: 130,
  tiles: [
    { x: 600, y: 300, r: 50 },
    { x: 720, y: 300, r: 50 },
    { x: 840, y: 300, r: 50 },
    { x: 720, y: 450, r: 50 },
  ],
  buttons: [
    { id: 'shuffle', x: 220, y: 700, w: 100, h: 90 },
    { id: 'hint', x: 340, y: 700, w: 100, h: 90 },
  ],
};

function setup() {
  const events: string[] = [];
  const tracer = new LetterTracer({
    letterAdded: (tile) => events.push(`add ${tile}`),
    letterRemoved: (tile) => events.push(`remove ${tile}`),
    wordSubmitted: (tiles) => events.push(`submit ${tiles.join(',')}`),
    selectionCleared: () => events.push('clear'),
    buttonTapped: (id) => events.push(`tap ${id}`),
  });
  tracer.setGeometry(GEOMETRY);
  const send = (type: PointerInput['type'], id: number, x: number, y: number, time?: number) =>
    tracer.handle({ type, id, x, y, time });
  const at = (i: number) => [GEOMETRY.tiles[i].x, GEOMETRY.tiles[i].y] as const;
  const hint = [390, 745] as const;
  const shuffle = [270, 745] as const;
  return { tracer, events, send, at, hint, shuffle };
}

describe('button taps', () => {
  it('taps a button', () => {
    const { events, send, hint } = setup();
    send('down', 1, ...hint);
    send('up', 1, ...hint);
    expect(events).toEqual(['tap hint']);
  });

  it('taps a button while her thumb rests in the safe zone', () => {
    const { events, send, hint } = setup();
    send('down', 1, 60, 600);
    send('down', 2, ...hint);
    send('up', 2, ...hint);
    expect(events).toEqual(['tap hint']);
  });

  it('taps a button while another finger rests elsewhere on the screen', () => {
    const { events, send, shuffle } = setup();
    send('down', 1, 500, 600);
    send('down', 2, ...shuffle);
    send('up', 2, ...shuffle);
    expect(events).toEqual(['tap shuffle']);
  });

  it('does not tap when the finger slides off the button before lifting', () => {
    const { events, send, hint } = setup();
    send('down', 1, ...hint);
    send('move', 1, 600, 600);
    send('up', 1, 600, 600);
    expect(events).toEqual([]);
  });

  it('does not tap when the press ends on a different button', () => {
    const { events, send, hint, shuffle } = setup();
    send('down', 1, ...hint);
    send('up', 1, ...shuffle);
    expect(events).toEqual([]);
  });

  it('does not tap when a resting thumb lifts off a button long after landing', () => {
    const { events, send, hint } = setup();
    send('down', 1, ...hint, 1000);
    send('up', 1, ...hint, 4000);
    expect(events).toEqual([]);
  });

  it('taps when the press is a normal length', () => {
    const { events, send, hint } = setup();
    send('down', 1, ...hint, 1000);
    send('up', 1, ...hint, 1600);
    expect(events).toEqual(['tap hint']);
  });

  it('ignores a press that starts in the safe zone and slides onto a button', () => {
    const { events, send, hint } = setup();
    send('down', 1, 150, 745);
    send('move', 1, ...hint);
    send('up', 1, ...hint);
    expect(events).toEqual([]);
  });

  it('ignores buttons while a word is being traced', () => {
    const { events, send, at, hint } = setup();
    send('down', 1, ...at(0));
    send('down', 2, ...hint);
    send('up', 2, ...hint);
    send('move', 1, ...at(1));
    expect(events).toEqual(['add 0', 'add 1']);
  });

  it('does not tap when the touch is cancelled or the tracer is disabled', () => {
    const { tracer, events, send, hint } = setup();
    send('down', 1, ...hint);
    send('cancel', 1, ...hint);
    tracer.setEnabled(false);
    send('down', 2, ...hint);
    send('up', 2, ...hint);
    expect(events).toEqual([]);
  });

  it('uses separate widths for the left and right safe zones', () => {
    const { tracer } = setup();
    expect(tracer.isInSafeZone(199)).toBe(true);
    expect(tracer.isInSafeZone(201)).toBe(false);
    expect(tracer.isInSafeZone(1049)).toBe(false);
    expect(tracer.isInSafeZone(1051)).toBe(true);
  });
});

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
    send('move', 1, ...at(3));
    send('move', 1, ...at(0));
    expect(events).toEqual(['add 0', 'add 1', 'add 3']);
    expect(tracer.selection).toEqual([0, 1, 3]);
  });

  it('adds a letter the finger crossed between two samples', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(2));
    send('up', 1, ...at(2));
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'submit 0,1,2']);
  });

  it('backtracks across letters the finger crossed between two samples', () => {
    const { tracer, events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(2));
    send('move', 1, ...at(0));
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'remove 2', 'remove 1']);
    expect(tracer.selection).toEqual([0]);
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

describe('pressed buttons', () => {
  function pressSetup() {
    const events: string[] = [];
    const tracer = new LetterTracer({
      letterAdded: () => {},
      letterRemoved: () => {},
      wordSubmitted: () => {},
      selectionCleared: () => {},
      buttonTapped: (id) => events.push(`tap ${id}`),
      buttonPressed: (id) => events.push(`press ${id}`),
      buttonReleased: (id) => events.push(`release ${id}`),
    });
    tracer.setGeometry(GEOMETRY);
    return { tracer, events };
  }

  it('reports the press, its release, then the tap', () => {
    const { tracer, events } = pressSetup();
    tracer.handle({ type: 'down', id: 1, x: 390, y: 745 });
    tracer.handle({ type: 'up', id: 1, x: 390, y: 745 });
    expect(events).toEqual(['press hint', 'release hint', 'tap hint']);
  });

  it('releases without a tap when the touch is cancelled', () => {
    const { tracer, events } = pressSetup();
    tracer.handle({ type: 'down', id: 1, x: 390, y: 745 });
    tracer.handle({ type: 'cancel', id: 1, x: 390, y: 745 });
    expect(events).toEqual(['press hint', 'release hint']);
  });

  it('releases a held button when the screen changes', () => {
    const { tracer, events } = pressSetup();
    tracer.handle({ type: 'down', id: 1, x: 390, y: 745 });
    tracer.setGeometry(GEOMETRY);
    expect(events).toEqual(['press hint', 'release hint']);
  });

  it('ignores presses that start in a safe zone', () => {
    const { tracer, events } = pressSetup();
    tracer.handle({ type: 'down', id: 1, x: 60, y: 745 });
    tracer.handle({ type: 'up', id: 1, x: 60, y: 745 });
    expect(events).toEqual([]);
  });
});

describe('scrolling', () => {
  // The clock pop-up: the whole card scrolls, and its Close button sits inside it.
  const CLOCK: TracerGeometry = {
    screenWidth: 1180,
    safeZoneLeft: 200,
    safeZoneRight: 130,
    tiles: [],
    buttons: [{ id: 'close', x: 410, y: 680, w: 360, h: 100 }],
    scrollAreas: [{ id: 'clock', x: 16, y: 16, w: 1148, h: 788 }],
  };

  function scrollSetup() {
    const events: string[] = [];
    const tracer = new LetterTracer({
      letterAdded: (tile) => events.push(`add ${tile}`),
      letterRemoved: (tile) => events.push(`remove ${tile}`),
      wordSubmitted: (tiles) => events.push(`submit ${tiles.join(',')}`),
      selectionCleared: () => events.push('clear'),
      buttonTapped: (id) => events.push(`tap ${id}`),
      scrolled: (id, dy) => events.push(`scroll ${id} ${dy}`),
    });
    tracer.setGeometry(CLOCK);
    const send = (type: PointerInput['type'], id: number, x: number, y: number) => tracer.handle({ type, id, x, y });
    return { tracer, events, send };
  }

  it('scrolls by how far the finger moves: up shows what is further down', () => {
    const { events, send } = scrollSetup();
    send('down', 1, 600, 500);
    send('move', 1, 600, 460);
    send('move', 1, 600, 430);
    send('move', 1, 600, 450);
    send('up', 1, 600, 450);
    expect(events).toEqual(['scroll clock 40', 'scroll clock 30', 'scroll clock -20']);
  });

  it('ignores a drag that starts in a safe zone', () => {
    const { events, send } = scrollSetup();
    send('down', 1, 100, 500);
    send('move', 1, 300, 400);
    send('up', 1, 300, 400);
    expect(events).toEqual([]);
  });

  it('scrolls while her thumb rests in the safe zone', () => {
    const { events, send } = scrollSetup();
    send('down', 1, 60, 500);
    send('move', 1, 62, 480);
    send('down', 2, 600, 500);
    send('move', 2, 600, 450);
    send('up', 2, 600, 450);
    expect(events).toEqual(['scroll clock 50']);
  });

  it('follows only the first scrolling finger', () => {
    const { events, send } = scrollSetup();
    send('down', 1, 600, 500);
    send('down', 2, 800, 500);
    send('move', 2, 800, 300);
    send('move', 1, 600, 490);
    expect(events).toEqual(['scroll clock 10']);
  });

  it('still taps a button inside the scrolling area', () => {
    const { events, send } = scrollSetup();
    send('down', 1, 590, 730);
    send('up', 1, 590, 730);
    expect(events).toEqual(['tap close']);
  });

  it('stops scrolling when the screen changes', () => {
    const { tracer, events, send } = scrollSetup();
    send('down', 1, 600, 500);
    tracer.setGeometry(CLOCK);
    send('move', 1, 600, 400);
    expect(events).toEqual([]);
  });

  it('is not tracing a word while scrolling', () => {
    const { tracer, send } = scrollSetup();
    send('down', 1, 600, 500);
    expect(tracer.isTracing).toBe(false);
  });
});
