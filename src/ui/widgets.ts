import { FONT_HEIGHT } from '../core/font.ts';
import { C } from '../core/palette.ts';
import type { Painter, Rect } from '../core/painter.ts';
import { SCREEN_W, SCREEN_H, TOP_BAR_H, BOTTOM_BAR_H } from '../core/screen.ts';

/** Title strip drawn at the top of menu-style screens. */
export function header(p: Painter, title: string): void {
  p.gradientV(0, 0, SCREEN_W, TOP_BAR_H, C.panelHi, C.panel);
  p.hLine(0, TOP_BAR_H - 1, SCREEN_W, C.line);
  p.text(title, SCREEN_W / 2, 3, C.gold, 'center');
}

/** Soft-key strip drawn at the bottom of every screen. */
export function softkeys(p: Painter, left?: string, right?: string, middle?: string): void {
  const y = SCREEN_H - BOTTOM_BAR_H;
  p.gradientV(0, y, SCREEN_W, BOTTOM_BAR_H, C.panel, C.panelLo);
  p.hLine(0, y, SCREEN_W, C.line);
  if (left) p.text(left, 3, y + 3, C.ink);
  if (right) p.text(right, SCREEN_W - 3, y + 3, C.ink, 'right');
  if (middle) p.text(middle, SCREEN_W / 2, y + 3, C.inkDim, 'center');
}

/** Scrollbar drawn on the right edge of a list. */
export function scrollbar(p: Painter, r: Rect, first: number, visible: number, total: number): void {
  if (total <= visible) return;
  p.fill(r.x, r.y, 2, r.h, C.panelLo);
  const barH = Math.max(4, Math.round((visible / total) * r.h));
  const maxTop = r.h - barH;
  const barY = r.y + Math.round((first / (total - visible)) * maxTop);
  p.fill(r.x, barY, 2, barH, C.gold);
}

export interface ListLayout {
  /** Index of the first visible row. */
  first: number;
  /** Number of rows that fit. */
  visible: number;
}

/** Keeps `selected` inside the window and returns the window to draw. */
export function listWindow(selected: number, total: number, rowH: number, areaH: number, first: number): ListLayout {
  const visible = Math.max(1, Math.floor(areaH / rowH));
  let f = first;
  if (selected < f) f = selected;
  if (selected >= f + visible) f = selected - visible + 1;
  f = Math.max(0, Math.min(f, Math.max(0, total - visible)));
  return { first: f, visible };
}

/** Background for one list row, highlighted when selected. */
export function row(p: Painter, x: number, y: number, w: number, h: number, selected: boolean): void {
  if (selected) {
    p.gradientV(x, y, w, h, C.selBgAlt, C.selBg);
    p.hLine(x, y, w, C.gold);
    p.hLine(x, y + h - 1, w, C.panelLo);
  } else {
    p.dottedLine(x, y + h - 1, w, C.lineSoft);
  }
}

/** Centred message used for empty lists and confirmations. */
export function notice(p: Painter, text: string, area: Rect, color = C.inkDim): void {
  const lines = p.wrap(text, area.w - 12);
  const h = lines.length * (FONT_HEIGHT + 2);
  const y = area.y + Math.max(2, Math.round((area.h - h) / 2));
  lines.forEach((line, i) => {
    p.text(line, area.x + area.w / 2, y + i * (FONT_HEIGHT + 2), color, 'center');
  });
}

/** Modal dialog box with a wrapped message and optional yes/no prompt. */
export function dialog(p: Painter, text: string, opts?: { yes?: string; no?: string; selected?: number }): void {
  const boxW = SCREEN_W - 20;
  const lines = p.wrap(text, boxW - 12);
  const textH = lines.length * (FONT_HEIGHT + 2);
  const hasButtons = Boolean(opts?.yes || opts?.no);
  const boxH = textH + 14 + (hasButtons ? 14 : 0);
  const x = 10;
  const y = Math.max(14, Math.round((SCREEN_H - boxH) / 2));

  p.setAlpha(0.6);
  p.fill(0, 0, SCREEN_W, SCREEN_H, '#000');
  p.setAlpha(1);

  p.panel(x, y, boxW, boxH, { fill: C.panel });
  p.stroke(x, y, boxW, boxH, C.gold);
  lines.forEach((line, i) => {
    p.text(line, SCREEN_W / 2, y + 7 + i * (FONT_HEIGHT + 2), C.ink, 'center');
  });

  if (hasButtons) {
    const by = y + boxH - 11;
    const labels = [opts?.yes ?? '', opts?.no ?? ''].filter(Boolean);
    const slot = boxW / labels.length;
    labels.forEach((label, i) => {
      const cx = x + slot * i + slot / 2;
      const active = (opts?.selected ?? 0) === i;
      const w = p.measure(label) + 10;
      if (active) {
        p.box(Math.round(cx - w / 2), by - 2, w, 11, C.selBgAlt, C.gold);
      }
      p.text(label, cx, by + 1, active ? C.selInk : C.inkDim, 'center');
    });
  }
}

/**
 * Horizontal strip of sub-screen labels. A single label still gets the strip so
 * that the "switchable with Tab" affordance stays in the same place everywhere.
 */
export function subTabs(
  p: Painter,
  x: number,
  y: number,
  w: number,
  labels: string[],
  active: number,
  switchable = true,
): void {
  const arrowW = switchable ? 9 : 0;
  const usable = w - arrowW;
  const slot = Math.floor(usable / labels.length);
  labels.forEach((label, i) => {
    const bx = x + slot * i;
    const on = i === active;
    p.gradientV(bx, y, slot - 1, 10, on ? C.selBgAlt : C.panelLo, on ? C.selBg : C.bar);
    if (on) p.hLine(bx, y, slot - 1, C.gold);
    p.text(label, bx + slot / 2, y + 2, on ? C.selInk : C.inkFaint, 'center');
  });
  // Tab-to-switch marker on the right edge of the strip.
  if (switchable) {
    p.fill(x + usable, y, arrowW, 10, C.bar);
    p.text('⇄', x + usable + arrowW / 2, y + 2, C.gold, 'center');
  }
  p.hLine(x, y + 10, w, C.line);
}

/** Two-column "label ......... value" line, used all over the detail panes. */
export function fieldLine(p: Painter, label: string, value: string, x: number, y: number, w: number, valueColor = C.gold): void {
  p.text(value, x + w, y, valueColor, 'right');
  p.textClipped(label, x, y, w - p.measure(value) - 4, C.inkDim);
}

export function formatMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const digits = Math.abs(Math.round(v)).toString();
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ' ';
    out += digits[i];
  }
  return `${sign}${out}`;
}

/** Rating stored in thousandths of a percent, shown with one decimal. */
export function formatRating(v: number): string {
  return `${(v / 1000).toFixed(1)}%`;
}
