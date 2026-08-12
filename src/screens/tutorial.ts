import { C } from '../core/palette.ts';
import type { Painter } from '../core/painter.ts';
import { BOTTOM_BAR_H, SCREEN_H, SCREEN_W, TAB_STRIP_W } from '../core/screen.ts';
import { drawPerson, type PersonLook } from '../art/people.ts';
import { ctxOf, makeCanvas } from '../art/pixel.ts';
import { tutorialText } from '../game/tutorial.ts';
import type { GameState } from '../game/state.ts';
import { FONT_HEIGHT } from '../core/font.ts';

/** Coach sprite — a pizza-headed mascot ("Пицца Мэн"). */
const PIZZA_MAN: PersonLook = {
  skin: '#f0c090',
  hair: '#c44a3a',
  shirt: '#e0452c',
  shirtDark: '#a83220',
  trousers: '#2f3542',
  shoes: '#1a120c',
  hat: 'chef',
  hatColor: '#f6f0e2',
};

let pizzaManSprite: HTMLCanvasElement | null = null;

function pizzaManCanvas(): HTMLCanvasElement {
  if (pizzaManSprite) return pizzaManSprite;
  const canvas = makeCanvas(9, 19);
  const ctx = ctxOf(canvas);
  drawPerson(ctx, PIZZA_MAN, 'stand');
  // Pizza "face" disc over the head.
  ctx.fillStyle = '#ffd15c';
  ctx.fillRect(1, 1, 7, 5);
  ctx.fillStyle = '#e0452c';
  ctx.fillRect(2, 2, 1, 1);
  ctx.fillRect(5, 2, 1, 1);
  ctx.fillRect(3, 4, 3, 1);
  ctx.fillStyle = '#79b04a';
  ctx.fillRect(4, 3, 1, 1);
  pizzaManSprite = canvas;
  return canvas;
}

/**
 * Draws the first-mission coach in the lower-left corner with the current tip.
 * Returns the bubble height so callers can reserve space if needed.
 */
export function drawTutorialCoach(p: Painter, s: GameState, clock: number): void {
  const text = tutorialText(s);
  if (!text) return;

  const maxBubbleW = SCREEN_W - TAB_STRIP_W - 28;
  const lines = p.wrap(text, maxBubbleW - 8);
  const lineH = FONT_HEIGHT + 2;
  const bubbleH = Math.max(22, lines.length * lineH + 8);
  const bubbleW = Math.min(
    maxBubbleW,
    Math.max(80, ...lines.map((l) => p.measure(l))) + 10,
  );

  const footY = SCREEN_H - BOTTOM_BAR_H - 2;
  const sprite = pizzaManCanvas();
  const sx = 3;
  const sy = footY - 19;
  const bx = sx + 12;
  const by = footY - bubbleH - 2;

  // Soft backdrop so the tip stays readable over the playfield.
  p.setAlpha(0.55);
  p.fill(1, by - 2, bx + bubbleW + 2, footY - (by - 2), '#120c08');
  p.setAlpha(1);

  p.blit(sprite, sx, sy);

  // Bounce a little so the coach feels alive.
  const bob = Math.floor(clock / 350) % 2;
  p.panel(bx, by - bob, bubbleW, bubbleH, { fill: '#f4ead6', raised: true });
  p.stroke(bx, by - bob, bubbleW, bubbleH, C.inkDark);
  // Tail toward the mascot.
  p.px(bx - 1, by - bob + bubbleH - 6, C.inkDark);
  p.px(bx - 2, by - bob + bubbleH - 5, C.inkDark);
  p.fill(bx, by - bob + bubbleH - 7, 3, 3, '#f4ead6');

  lines.forEach((line, i) => {
    p.text(line, bx + 5, by - bob + 4 + i * lineH, C.inkDark);
  });
}
