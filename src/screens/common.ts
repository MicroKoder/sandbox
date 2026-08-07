import { C } from '../core/palette.ts';
import type { Painter } from '../core/painter.ts';
import { SCREEN_H, SCREEN_W } from '../core/screen.ts';

/** Warm checkered backdrop used behind the menus. */
export function menuBackground(p: Painter, clock: number): void {
  p.gradientV(0, 0, SCREEN_W, SCREEN_H, '#2a1a12', '#150e0a');

  // Slow drifting diagonal stripes, like a tablecloth.
  const shift = Math.floor(clock / 90) % 24;
  p.setAlpha(0.12);
  for (let i = -SCREEN_H; i < SCREEN_W; i += 24) {
    for (let y = 0; y < SCREEN_H; y++) {
      p.px(i + y + shift, y, C.orange);
      p.px(i + y + shift + 1, y, C.orange);
    }
  }
  p.setAlpha(1);
}

/** The pizza-slice mark used on the splash and menu screens. */
export function drawLogoMark(p: Painter, cx: number, cy: number, r: number): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d > r) continue;
      let color = C.cheese;
      if (d > r - 2) color = '#b8762c';
      else if (d > r - 4) color = C.crust;
      p.px(cx + x, cy + y, color);
    }
  }
  // Toppings.
  const spots: Array<[number, number, string]> = [
    [-4, -3, C.tomato],
    [3, -5, C.tomato],
    [5, 2, C.tomato],
    [-2, 5, C.tomato],
    [-6, 1, C.basil],
    [1, 1, C.basil],
    [4, 6, C.basil],
  ];
  for (const [dx, dy, color] of spots) {
    p.fill(cx + dx, cy + dy, 2, 2, color);
  }
}

/** Draws a paragraph with a scroll offset and returns the total content height. */
export function scrollText(
  p: Painter,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  scroll: number,
  color = C.ink,
): number {
  const lines = p.wrap(text, w);
  const step = 9;
  p.pushClip({ x, y, w: w + 2, h });
  lines.forEach((line, i) => {
    const ly = y + i * step - scroll;
    if (ly > y - step && ly < y + h) p.text(line, x, ly, color);
  });
  p.popClip();
  return lines.length * step;
}
