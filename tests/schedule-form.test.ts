import { describe, expect, it } from 'vitest';
import { parseSchedule } from '../src/clock/schedule';
import { currentLines, eventLine, eventRow, type EventEntry } from '../src/settings/schedule-form';

const entry = (overrides: Partial<EventEntry>): EventEntry => ({
  what: 'Supper',
  repeat: 'daily',
  date: '',
  days: [],
  time: '18:00',
  ...overrides,
});

describe('eventLine', () => {
  it('writes each kind of event as a schedule.txt line', () => {
    expect(eventLine(entry({}))).toBe('every day 6:00 PM Supper');
    expect(eventLine(entry({ what: 'Phone call', repeat: 'days', days: [5, 2], time: '15:00' }))).toBe('Tue,Fri 3:00 PM Phone call');
    expect(eventLine(entry({ what: 'Doctor visit', repeat: 'once', date: '2026-10-22', time: '14:00' }))).toBe(
      '2026-10-22 2:00 PM Doctor visit',
    );
  });

  it('makes lines the clock reads back as the same event', () => {
    const [event] = parseSchedule(eventLine(entry({ what: 'Church', repeat: 'days', days: [0], time: '10:30' }))!);
    expect(event).toEqual({ name: 'Church', minutes: 630, repeat: { kind: 'weekdays', days: [0] } });
  });

  it('handles midnight and noon', () => {
    expect(eventLine(entry({ time: '00:15' }))).toBe('every day 12:15 AM Supper');
    expect(eventLine(entry({ time: '12:00' }))).toBe('every day 12:00 PM Supper');
  });

  it('tidies the name', () => {
    expect(eventLine(entry({ what: '  Supper   with  Jo ' }))).toBe('every day 6:00 PM Supper with Jo');
  });

  it('waits until everything is filled in', () => {
    expect(eventLine(entry({ what: '  ' }))).toBeNull();
    expect(eventLine(entry({ time: '' }))).toBeNull();
    expect(eventLine(entry({ repeat: 'days', days: [] }))).toBeNull();
    expect(eventLine(entry({ repeat: 'once', date: '' }))).toBeNull();
  });
});

describe('eventRow', () => {
  it('describes an event in words', () => {
    expect(eventRow('every day 6:00 PM Supper')).toBe('Supper · every day · 6:00 PM');
    expect(eventRow('Tue,Fri 3:00 PM Phone call')).toBe('Phone call · Tue, Fri · 3:00 PM');
    expect(eventRow('2026-10-22 2:00 PM Doctor visit')).toBe('Doctor visit · Thu Oct 22 · 2:00 PM');
  });

  it('gives null for a line it cannot read', () => {
    expect(eventRow('sometime Supper')).toBeNull();
  });
});

describe('currentLines', () => {
  it('drops one-time events from earlier days, and lines it cannot read', () => {
    const lines = ['every day 6:00 PM Supper', '2026-10-18 2:00 PM Old visit', '2026-10-19 2:00 PM Today visit', 'nonsense'];
    expect(currentLines(lines, '2026-10-19')).toEqual(['every day 6:00 PM Supper', '2026-10-19 2:00 PM Today visit']);
  });
});
