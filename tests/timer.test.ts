import { describe, expect, it } from 'vitest';
import { IDLE_CAP_MS, PlayTimer } from '../src/game/timer';

describe('PlayTimer', () => {
  it('counts the time between touches', () => {
    const timer = new PlayTimer();
    timer.activity(1_000);
    timer.activity(6_000);
    timer.activity(16_000);
    expect(timer.elapsedMs).toBe(15_000);
  });

  it('counts at most a minute for a long stretch without touches', () => {
    const timer = new PlayTimer();
    timer.activity(0);
    timer.activity(10 * 60_000);
    expect(timer.elapsedMs).toBe(IDLE_CAP_MS);
  });

  it('stops counting while paused and picks up again on resume', () => {
    const timer = new PlayTimer();
    timer.activity(0);
    timer.activity(5_000);
    timer.pause();
    timer.resume(500_000);
    timer.activity(503_000);
    expect(timer.elapsedMs).toBe(8_000);
  });

  it('ignores touches while paused', () => {
    const timer = new PlayTimer();
    timer.activity(0);
    timer.pause();
    timer.activity(30_000);
    expect(timer.elapsedMs).toBe(0);
  });

  it('continues from saved time', () => {
    const timer = new PlayTimer(42_000);
    timer.activity(0);
    timer.activity(3_000);
    expect(timer.elapsedMs).toBe(45_000);
  });
});
