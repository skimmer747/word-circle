import { describe, expect, it } from 'vitest';
import { computeFrameLayout, SAFE_ZONE_MIN, SAFE_ZONE_THUMB } from '../src/frame/layout';
import { SCREENS, SCREENS_AND_THUMBS, inPlayArea } from './screens';

describe.each(SCREENS_AND_THUMBS)('frame layout on a %i×%i screen, thumb %s', (width, height, thumb) => {
  const frame = computeFrameLayout(width, height, 3, thumb);

  it('gives a resting thumb a wider safe zone where the screen has room, and the other sides an inch', () => {
    const wide = thumb === 'left' ? frame.safeZoneLeft : thumb === 'right' ? frame.safeZoneRight : null;
    const narrow =
      thumb === 'left' ? [frame.safeZoneRight] : thumb === 'right' ? [frame.safeZoneLeft] : [frame.safeZoneLeft, frame.safeZoneRight];
    for (const zone of narrow) expect(zone).toBe(SAFE_ZONE_MIN);
    if (wide !== null) {
      expect(wide).toBeGreaterThanOrEqual(SAFE_ZONE_MIN);
      expect(wide).toBeLessThanOrEqual(SAFE_ZONE_THUMB);
      if (width >= 1133) expect(wide).toBe(SAFE_ZONE_THUMB);
    }
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

  it('puts Back to puzzle and Your stats side by side above Next, clear of the safe zones', () => {
    const { backButton, cardStatsButton, nextButton, shareButton, nextWordButton } = frame;
    for (const button of [backButton, cardStatsButton]) {
      expect(inPlayArea(button, frame), JSON.stringify(button)).toBe(true);
      expect(button.h).toBeGreaterThanOrEqual(80);
      expect(button.y + button.h).toBeLessThanOrEqual(Math.min(nextButton.y, shareButton.y, nextWordButton.y) - 12);
    }
    expect(backButton.y).toBe(cardStatsButton.y);
    expect(backButton.x + backButton.w).toBeLessThan(cardStatsButton.x);
    expect(backButton.w).toBeGreaterThanOrEqual(320);
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
    expect(gameCards).toHaveLength(3);
    gameCards.forEach((game, i) => {
      expect(inPlayArea(game, frame), JSON.stringify(game)).toBe(true);
      expect(game.w).toBeGreaterThanOrEqual(220);
      expect(game.h).toBeGreaterThanOrEqual(360);
      expect(game.y).toBeGreaterThanOrEqual(card.y + 100);
      expect(game.y + game.h).toBeLessThanOrEqual(closeButton.y - 16);
      if (i > 0) expect(game.x).toBeGreaterThanOrEqual(gameCards[i - 1].x + gameCards[i - 1].w + 16);
    });
  });

  it('puts a pair of buttons where the single Close was, below the game cards', () => {
    const { shareButton, nextWordButton, closeButton, gameCards } = frame;
    expect(shareButton.y).toBe(closeButton.y);
    expect(nextWordButton.y).toBe(closeButton.y);
    for (const game of gameCards) expect(game.y + game.h).toBeLessThanOrEqual(shareButton.y - 16);
  });

  it("puts every game's Hint button in the top-left corner of the play area", () => {
    expect(frame.hintButton).toEqual({ x: frame.play.x, y: frame.play.y, w: 130, h: 96 });
  });

  it('puts the help bubble just under Hint, big, in the play area and clear of the corner', () => {
    const { helpBubble: bubble, hintButton: hint, corner } = frame;
    expect(inPlayArea(bubble, frame)).toBe(true);
    expect(bubble.x).toBe(hint.x);
    expect(bubble.y).toBeGreaterThan(hint.y + hint.h);
    expect(bubble.y - (hint.y + hint.h)).toBeLessThanOrEqual(24);
    expect(bubble.w).toBeGreaterThanOrEqual(400);
    expect(bubble.h).toBeGreaterThanOrEqual(110);
    expect(bubble.x + bubble.w <= corner.x || bubble.y >= corner.y + corner.h).toBe(true);
  });

  it("puts every game's level buttons in a row at the bottom left, big enough to tap", () => {
    const { levelButtons, play } = frame;
    expect(levelButtons).toHaveLength(3);
    levelButtons.forEach((button, i) => {
      expect(inPlayArea(button, frame)).toBe(true);
      expect(button.h).toBeGreaterThanOrEqual(60);
      expect(button.w).toBeGreaterThanOrEqual(100);
      expect(button.y + button.h).toBe(play.y + play.h);
      expect(button.x).toBe(i === 0 ? play.x : levelButtons[i - 1].x + levelButtons[i - 1].w + 8);
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

describe.each(SCREENS)('thumb sides on a %i×%i screen', (width, height) => {
  it('keeps the left thumb layout exactly as it was', () => {
    expect(computeFrameLayout(width, height, 3)).toEqual(computeFrameLayout(width, height, 3, 'left'));
  });

  it('mirrors the safe zones for a right thumb', () => {
    const left = computeFrameLayout(width, height, 3, 'left');
    const right = computeFrameLayout(width, height, 3, 'right');
    expect(right.safeZoneLeft).toBe(left.safeZoneRight);
    expect(right.safeZoneRight).toBe(left.safeZoneLeft);
    expect(right.play.w).toBe(left.play.w);
  });

  it('fits one game card in the Games pop-up', () => {
    const frame = computeFrameLayout(width, height, 1);
    expect(frame.gameCards).toHaveLength(1);
    expect(inPlayArea(frame.gameCards[0], frame)).toBe(true);
  });
});
