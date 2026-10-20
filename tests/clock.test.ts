import { describe, expect, it } from 'vitest';
import { clockFace, greeting, upcomingEvents } from '../src/clock/clock';
import { parseSchedule } from '../src/clock/schedule';

// Monday, October 19, 2026 (local time).
const at = (h: number, m = 0, day = 19) => new Date(2026, 9, day, h, m);

describe('clockFace', () => {
  it('says the time, part of day and date in plain words', () => {
    expect(clockFace(at(10, 30))).toEqual({ greeting: '', time: '10:30 AM', part: 'in the morning', date: 'Monday, October 19' });
    expect(clockFace(at(14, 5)).part).toBe('in the afternoon');
    expect(clockFace(at(18, 40)).part).toBe('in the evening');
    expect(clockFace(at(22, 0)).part).toBe('at night');
    expect(clockFace(at(3, 0)).part).toBe('at night');
  });

  it('greets her by name when it has one', () => {
    expect(clockFace(at(10, 30), 'Ruth').greeting).toBe('Good morning, Ruth');
    expect(clockFace(at(18, 40), 'Ruth').greeting).toBe('Good evening, Ruth');
    expect(clockFace(at(22, 0), 'Ruth').greeting).toBe('Hello, Ruth');
  });

  it('handles noon and midnight', () => {
    expect(clockFace(at(12, 0))).toMatchObject({ time: '12:00 PM', part: 'in the afternoon' });
    expect(clockFace(at(0, 7))).toMatchObject({ time: '12:07 AM', part: 'at night' });
  });
});

describe('greeting', () => {
  it('greets her by the clock\'s part of day, with a plain hello at night', () => {
    expect(greeting('Ruth', at(5, 0))).toBe('Good morning, Ruth');
    expect(greeting('Ruth', at(11, 59))).toBe('Good morning, Ruth');
    expect(greeting('Ruth', at(12, 0))).toBe('Good afternoon, Ruth');
    expect(greeting('Ruth', at(16, 59))).toBe('Good afternoon, Ruth');
    expect(greeting('Ruth', at(17, 0))).toBe('Good evening, Ruth');
    expect(greeting('Ruth', at(20, 59))).toBe('Good evening, Ruth');
    expect(greeting('Ruth', at(21, 0))).toBe('Hello, Ruth');
    expect(greeting('Ruth', at(3, 0))).toBe('Hello, Ruth');
    expect(greeting('Ruth', at(4, 59))).toBe('Hello, Ruth');
  });

  it('says nothing without a name', () => {
    expect(greeting('', at(9))).toBe('');
  });
});

/** Just the countdown lines. */
const countdowns = (...args: Parameters<typeof upcomingEvents>) => upcomingEvents(...args).map((event) => event.text);

describe('upcomingEvents', () => {
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
    expect(countdowns(events, at(10, 30))).toEqual([
      'Visit from Ann in 30 minutes',
      'Lunch in 1 hour 30 minutes',
      'Supper in 6 hours 30 minutes',
      'Bingo in 8 hours 30 minutes',
    ]);
  });

  it('shows no more than the limit', () => {
    expect(countdowns(events, at(6, 0), 2)).toEqual(['Breakfast in 2 hours', 'Visit from Ann in 5 hours']);
  });

  it('says it is time from 5 minutes before until 30 minutes after', () => {
    expect(countdowns(events, at(16, 56))[0]).toBe('Time for Supper');
    expect(countdowns(events, at(17, 30))[0]).toBe('Time for Supper');
    expect(countdowns(events, at(17, 31))[0]).toBe('Bingo in 1 hour 29 minutes');
  });

  it('counts down to one-off events coming up this week', () => {
    expect(countdowns(events, at(20, 0))).toEqual([
      'Hair appointment in 13 hours',
      'Doctor visit in 2 days and 18 hours',
    ]);
  });

  it('says days and hours, to the nearest hour, once an event is a day or more away', () => {
    const doctor = parseSchedule('2026-10-22 2:00 PM Doctor visit');
    expect(countdowns(doctor, at(13, 20))).toEqual(['Doctor visit in 3 days and 1 hour']);
    expect(countdowns(doctor, at(13, 40))).toEqual(['Doctor visit in 3 days']);
    expect(countdowns(doctor, at(14, 29))).toEqual(['Doctor visit in 3 days']);
    expect(countdowns(doctor, at(14, 31))).toEqual(['Doctor visit in 2 days and 23 hours']);
    expect(countdowns(doctor, at(13, 0, 21))).toEqual(['Doctor visit in 1 day and 1 hour']);
    expect(countdowns(doctor, at(14, 0, 21))).toEqual(['Doctor visit in 1 day']);
    expect(countdowns(doctor, at(14, 30, 21))).toEqual(['Doctor visit in 23 hours 30 minutes']);
  });

  it('counts minutes up so it never says zero', () => {
    expect(countdowns(parseSchedule('every day 9:00 AM Pills'), new Date(2026, 9, 19, 8, 0, 30))).toEqual([
      'Pills in 1 hour',
    ]);
    expect(countdowns(parseSchedule('every day 9:00 AM Pills'), new Date(2026, 9, 19, 8, 54, 10))).toEqual([
      'Pills in 6 minutes',
    ]);
  });

  it('is empty when nothing is coming up', () => {
    expect(countdowns([], at(10))).toEqual([]);
  });
});

describe('when each event is', () => {
  const events = parseSchedule(
    [
      'every day 6:00 PM Supper',
      '2026-10-20 11:00 AM Jermaine',
      '2026-10-21 7:00 PM RuthAnne gets home',
      '2026-10-26 9:30 AM Doctor visit',
    ].join('\n'),
  );

  it('says the day and time under each countdown: today, tomorrow, then the date', () => {
    expect(upcomingEvents(events, at(17, 30))).toEqual([
      { text: 'Supper in 30 minutes', when: 'Today at 6:00 PM', now: false },
      { text: 'Jermaine in 17 hours 30 minutes', when: 'Tomorrow, Tuesday, October 20 at 11:00 AM', now: false },
      { text: 'RuthAnne gets home in 2 days and 2 hours', when: 'Wednesday, October 21 at 7:00 PM', now: false },
      { text: 'Doctor visit in 6 days and 16 hours', when: 'Monday, October 26 at 9:30 AM', now: false },
    ]);
  });

  it('marks the event it is time for', () => {
    expect(upcomingEvents(events, at(18, 10))[0]).toEqual({ text: 'Time for Supper', when: 'Today at 6:00 PM', now: true });
  });

  it('says tomorrow across the end of a month', () => {
    const halloween = parseSchedule('2026-11-01 10:00 AM Church');
    expect(upcomingEvents(halloween, new Date(2026, 9, 31, 20, 0))[0].when).toBe('Tomorrow, Sunday, November 1 at 10:00 AM');
  });
});
