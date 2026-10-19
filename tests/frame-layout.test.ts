import { describe, expect, it } from 'vitest';
import { computeFrameLayout, SAFE_ZONE_LEFT_MIN, SAFE_ZONE_LEFT_TARGET, SAFE_ZONE_RIGHT } from '../src/frame/layout';
import { SCREENS, inPlayArea } from './screens';

describe.each(SCREENS)('frame layout on a %i×%i screen', (width, height) => {
  const frame = computeFrameLayout(width, height);

  it('gives her left thumb a wider safe zone where the screen has room', () => {
    expect(frame.safeZoneRight).toBe(SAFE_ZONE_RIGHT);
    expect(frame.safeZoneLeft).toBeGreaterThanOrEqual(SAFE_ZONE_LEFT_MIN);
    expect(frame.safeZoneLeft).toBeLessThanOrEqual(SAFE_ZONE_LEFT_TARGET);
    if (width >= 1133) expect(frame.safeZoneLeft).toBe(SAFE_ZONE_LEFT_TARGET);
  });

  it('makes the play area the space between the safe zones, inside a 16 px margin', () => {
    const { play } = frame;
    expect(play.x).toBe(frame.safeZoneLeft + 16);
    expect(play.x + play.w).toBe(width - frame.safeZoneRight - 16);
    expect(play.y).toBe(16);
    expect(play.y + play.h).toBe(height - 16);
  });

  it('puts the clock button at the top right of the play area, inside the corner', () => {
    const { clockButton, corner, play } = frame;
    expect(inPlayArea(clockButton, frame)).toBe(true);
    expect(clockButton.w).toBeGreaterThanOrEqual(64);
    expect(clockButton.h).toBeGreaterThanOrEqual(64);
    expect(clockButton.x + clockButton.w).toBeCloseTo(play.x + play.w, 5);
    expect(clockButton.y).toBe(16);
    expect(corner.x).toBeLessThanOrEqual(clockButton.x);
    expect(corner.x + corner.w).toBeGreaterThanOrEqual(clockButton.x + clockButton.w);
  });

  it('fills almost the whole screen with the pop-up card', () => {
    const { card } = frame;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.x + card.w).toBeLessThanOrEqual(width);
    expect(card.y + card.h).toBeLessThanOrEqual(height);
    expect(card.w).toBeGreaterThanOrEqual(width - 40);
    expect(card.h).toBeGreaterThanOrEqual(height - 40);
  });

  it('puts a big Next button at the bottom of the card, clear of the safe zones', () => {
    const { card, nextButton } = frame;
    expect(inPlayArea(nextButton, frame)).toBe(true);
    expect(nextButton.h).toBeGreaterThanOrEqual(96);
    expect(nextButton.w).toBeGreaterThanOrEqual(400);
    expect(Math.abs(nextButton.x + nextButton.w / 2 - width / 2)).toBeLessThan(1);
    expect(nextButton.y + nextButton.h).toBeLessThanOrEqual(card.y + card.h);
  });

  it('puts the Games button just left of the clock, the same size and in the same row', () => {
    const { gamesButton, clockButton, corner } = frame;
    expect(inPlayArea(gamesButton, frame)).toBe(true);
    expect(gamesButton.w).toBe(clockButton.w);
    expect(gamesButton.h).toBe(clockButton.h);
    expect(gamesButton.y).toBe(clockButton.y);
    expect(gamesButton.x + gamesButton.w).toBe(clockButton.x - 12);
    expect(corner).toEqual({ x: gamesButton.x, y: 16, w: clockButton.x + clockButton.w - gamesButton.x, h: clockButton.h });
  });

  it('fits Share and Next word side by side at the bottom of the card, clear of the safe zones', () => {
    const { shareButton, nextWordButton, card } = frame;
    for (const button of [shareButton, nextWordButton]) {
      expect(inPlayArea(button, frame), JSON.stringify(button)).toBe(true);
      expect(button.h).toBeGreaterThanOrEqual(96);
      expect(button.y + button.h).toBeLessThanOrEqual(card.y + card.h);
    }
    expect(shareButton.x + shareButton.w).toBeLessThan(nextWordButton.x);
    expect(nextWordButton.w).toBeGreaterThanOrEqual(360);
  });

  it('gives the Games pop-up one big card per game, below its title and above Close', () => {
    const { gameCards, closeButton, card } = frame;
    expect(gameCards).toHaveLength(2);
    gameCards.forEach((game, i) => {
      expect(inPlayArea(game, frame), JSON.stringify(game)).toBe(true);
      expect(game.w).toBeGreaterThanOrEqual(300);
      expect(game.h).toBeGreaterThanOrEqual(360);
      expect(game.y).toBeGreaterThanOrEqual(card.y + 100);
      expect(game.y + game.h).toBeLessThanOrEqual(closeButton.y - 16);
      if (i > 0) expect(game.x).toBeGreaterThanOrEqual(gameCards[i - 1].x + gameCards[i - 1].w + 16);
    });
  });

  it('gives the clock pop-up a big Close button clear of the safe zones', () => {
    const { card, closeButton } = frame;
    expect(inPlayArea(closeButton, frame)).toBe(true);
    expect(closeButton.h).toBeGreaterThanOrEqual(96);
    expect(closeButton.w).toBeGreaterThanOrEqual(340);
    expect(closeButton.y + closeButton.h).toBeLessThanOrEqual(card.y + card.h);
  });
});
