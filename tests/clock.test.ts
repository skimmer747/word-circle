import { describe, expect, it } from 'vitest';
import { clockFace, upcomingLines } from '../src/clock/clock';
import { parseSchedule } from '../src/clock/schedule';

// Monday, October 19, 2026 (local time).
const at = (h: number, m = 0, day = 19) => new Date(2026, 9, day, h, m);

describe('clockFace', () => {
  it('says the time, part of day and date in plain words', () => {
    expect(clockFace(at(10, 30))).toEqual({ time: '10:30 AM', part: 'in the morning', date: 'Monday, October 19' });
    expect(clockFace(at(14, 5)).part).toBe('in the afternoon');
    expect(clockFace(at(18, 40)).part).toBe('in the evening');
    expect(clockFace(at(22, 0)).part).toBe('at night');
    expect(clockFace(at(3, 0)).part).toBe('at night');
  });

  it('handles noon and midnight', () => {
    expect(clockFace(at(12, 0))).toMatchObject({ time: '12:00 PM', part: 'in the afternoon' });
    expect(clockFace(at(0, 7))).toMatchObject({ time: '12:07 AM', part: 'at night' });
  });
});

describe('upcomingLines', () => {
  const events = parseSchedule(
    [
      'every day 8:00 AM Breakfast',
      'every day 12:00 PM Lunch',
      'every day 5:00 PM Supper',
      'Tue 3:00 PM Phone call with Todd',
      'Mon 7:00 PM Bingo',
      '2026-10-22 2:00 PM Doctor visit',
      '2026-10-20 9:00 AM Hair appointment',
      '2026-11-30 1:00 PM Far away',
      '2026-10-19 11:00 AM Visit from Ann',
    ].join('\n'),
  );

  it('counts down to the rest of today, soonest first, then the coming week', () => {
    expect(upcomingLines(events, at(10, 30))).toEqual([
      'Visit from Ann in 30 minutes',
      'Lunch in 1 hour 30 minutes',
      'Supper in 6 hours 30 minutes',
      'Bingo in 8 hours 30 minutes',
    ]);
  });

  it('shows no more than the limit', () => {
    expect(upcomingLines(events, at(6, 0), 2)).toEqual(['Breakfast in 2 hours', 'Visit from Ann in 5 hours']);
  });

  it('says it is time from 5 minutes before until 30 minutes after', () => {
    expect(upcomingLines(events, at(16, 56))[0]).toBe('Time for Supper');
    expect(upcomingLines(events, at(17, 30))[0]).toBe('Time for Supper');
    expect(upcomingLines(events, at(17, 31))[0]).toBe('Bingo in 1 hour 29 minutes');
  });

  it('mentions one-off events coming up this week', () => {
    expect(upcomingLines(events, at(20, 0))).toEqual([
      'Hair appointment tomorrow at 9:00 AM',
      'Doctor visit on Thursday at 2:00 PM',
    ]);
  });

  it('counts minutes up so it never says zero', () => {
    expect(upcomingLines(parseSchedule('every day 9:00 AM Pills'), new Date(2026, 9, 19, 8, 0, 30))).toEqual([
      'Pills in 1 hour',
    ]);
    expect(upcomingLines(parseSchedule('every day 9:00 AM Pills'), new Date(2026, 9, 19, 8, 54, 10))).toEqual([
      'Pills in 6 minutes',
    ]);
  });

  it('is empty when nothing is coming up', () => {
    expect(upcomingLines([], at(10))).toEqual([]);
  });
});
