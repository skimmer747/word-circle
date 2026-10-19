import { describe, expect, it } from 'vitest';
import { parseSchedule, parseTime } from '../src/clock/schedule';

describe('parseTime', () => {
  it('reads the ways people write times', () => {
    expect(parseTime('5:00 PM')).toBe(17 * 60);
    expect(parseTime('5 PM')).toBe(17 * 60);
    expect(parseTime('5:30pm')).toBe(17 * 60 + 30);
    expect(parseTime('8:15 a.m.')).toBe(8 * 60 + 15);
    expect(parseTime('17:45')).toBe(17 * 60 + 45);
    expect(parseTime('12 PM')).toBe(12 * 60);
    expect(parseTime('12:30 AM')).toBe(30);
  });

  it('rejects times that do not exist', () => {
    expect(parseTime('13 PM')).toBeNull();
    expect(parseTime('9:75 AM')).toBeNull();
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('noonish')).toBeNull();
  });
});

describe('parseSchedule', () => {
  const TEXT = [
    '# Every day',
    'every day 8:00 AM Breakfast',
    'Daily 12 PM Lunch',
    '',
    'Sun 10:00 AM Church',
    'Tue, Fri 3:00 PM Phone call with Todd',
    'Wednesday 9 AM Hair appointment',
    '2026-10-22 2:00 PM Doctor visit',
    'every day 5:00 PM   Supper  ',
  ].join('\n');

  it('reads every kind of event', () => {
    expect(parseSchedule(TEXT)).toEqual([
      { name: 'Breakfast', minutes: 480, repeat: { kind: 'daily' } },
      { name: 'Lunch', minutes: 720, repeat: { kind: 'daily' } },
      { name: 'Church', minutes: 600, repeat: { kind: 'weekdays', days: [0] } },
      { name: 'Phone call with Todd', minutes: 900, repeat: { kind: 'weekdays', days: [2, 5] } },
      { name: 'Hair appointment', minutes: 540, repeat: { kind: 'weekdays', days: [3] } },
      { name: 'Doctor visit', minutes: 840, repeat: { kind: 'date', date: '2026-10-22' } },
      { name: 'Supper', minutes: 1020, repeat: { kind: 'daily' } },
    ]);
  });

  it('skips lines it cannot read and keeps the rest', () => {
    const events = parseSchedule(
      ['every day 5:00 PM Supper', 'Supper at five', 'Funday 3 PM Party', '2026-02-30 1 PM Nope', 'every day 99 PM Oops'].join('\n'),
    );
    expect(events.map((e) => e.name)).toEqual(['Supper']);
  });

  it('handles Windows line endings and an empty file', () => {
    expect(parseSchedule('every day 5 PM Supper\r\n')).toHaveLength(1);
    expect(parseSchedule('')).toEqual([]);
  });
});
