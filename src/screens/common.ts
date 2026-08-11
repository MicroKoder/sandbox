import { C, MOOD_COLORS } from '../core/palette.ts';
import type { Painter } from '../core/painter.ts';
import { SCREEN_H, SCREEN_W } from '../core/screen.ts';
import { getMoodIcons } from '../art/icons.ts';
import { MOODS } from '../data/strings.ts';

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

/**
 * Help layout for visitor moods: the same face icons used above customers' heads,
 * each next to its label and meaning.
 */
export function scrollEmotionsHelp(
  p: Painter,
  x: number,
  y: number,
  w: number,
  h: number,
  scroll: number,
): number {
  const icons = getMoodIcons();
  const intro = 'ЭМОЦИИ ПОСЕТИТЕЛЕЙ ЗАВИСЯТ ОТ КАЧЕСТВА ОБСЛУЖИВАНИЯ:';
  const outro =
    'ДОВОЛЬНЫЙ ГОСТЬ ПОДНИМАЕТ ВАШ РЕЙТИНГ И ОПУСКАЕТ РЕЙТИНГ КОНКУРЕНТА, НЕДОВОЛЬНЫЙ — НАОБОРОТ.';
  const lineStep = 9;
  const rowH = 15;
  const iconBox = 13;
  const textX = x + iconBox + 4;
  const textW = Math.max(40, w - iconBox - 4);

  const introLines = p.wrap(intro, w);
  const outroLines = p.wrap(outro, w);
  const listTop = introLines.length * lineStep + lineStep; // blank line after intro
  const outroTop = listTop + MOODS.length * rowH + 4;

  p.pushClip({ x, y, w: w + 2, h });

  introLines.forEach((line, i) => {
    const ly = y + i * lineStep - scroll;
    if (ly > y - lineStep && ly < y + h) p.text(line, x, ly, C.ink);
  });

  for (let i = 0; i < MOODS.length; i++) {
    const ly = y + listTop + i * rowH - scroll;
    if (ly > y - rowH && ly < y + h) {
      const mood = MOODS[i];
      const icon = icons[i];
      p.box(x, ly, iconBox, iconBox, '#f4ead6', C.inkDark);
      if (icon) p.blit(icon, x + 2, ly + 2);
      p.px(x + 1, ly + 1, MOOD_COLORS[i] ?? C.gold);
      p.text(mood.label, textX, ly + 2, C.ink);
      p.textClipped(mood.reason, textX, ly + 9, textW, C.inkFaint);
    }
  }

  outroLines.forEach((line, i) => {
    const ly = y + outroTop + i * lineStep - scroll;
    if (ly > y - lineStep && ly < y + h) p.text(line, x, ly, C.ink);
  });

  p.popClip();
  return outroTop + outroLines.length * lineStep;
}
