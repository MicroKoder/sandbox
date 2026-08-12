import { FONT_HEIGHT, FONT_TRACKING, FONT_SPACE, glyphOf, measure, wrap } from './font.ts';
import { C } from './palette.ts';

export type Align = 'left' | 'center' | 'right';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Immediate-mode pixel painter.
 *
 * The whole game is drawn into a single logical canvas which Phaser then uploads
 * as a texture and scales up with nearest-neighbour filtering. That mirrors how
 * the MIDlet drew into one off-screen `Image` and blitted it to the `FullCanvas`,
 * and it keeps every pixel under our control.
 */
export class Painter {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;

  private clipStack: Rect[] = [];

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
  }

  // ------------------------------------------------------------------ state

  clear(color: string = C.bg): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }

  pushClip(r: Rect): void {
    this.clipStack.push(r);
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(r.x, r.y, r.w, r.h);
    this.ctx.clip();
  }

  popClip(): void {
    if (this.clipStack.length === 0) return;
    this.clipStack.pop();
    this.ctx.restore();
  }

  setAlpha(a: number): void {
    this.ctx.globalAlpha = a;
  }

  // ----------------------------------------------------------------- shapes

  px(x: number, y: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x | 0, y | 0, 1, 1);
  }

  fill(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0));
  }

  fillRect(r: Rect, color: string): void {
    this.fill(r.x, r.y, r.w, r.h, color);
  }

  stroke(x: number, y: number, w: number, h: number, color: string): void {
    this.fill(x, y, w, 1, color);
    this.fill(x, y + h - 1, w, 1, color);
    this.fill(x, y, 1, h, color);
    this.fill(x + w - 1, y, 1, h, color);
  }

  strokeRect(r: Rect, color: string): void {
    this.stroke(r.x, r.y, r.w, r.h, color);
  }

  hLine(x: number, y: number, w: number, color: string): void {
    this.fill(x, y, w, 1, color);
  }

  vLine(x: number, y: number, h: number, color: string): void {
    this.fill(x, y, 1, h, color);
  }

  /** Horizontal dotted rule — used as a light separator inside lists. */
  dottedLine(x: number, y: number, w: number, color: string, step = 2): void {
    for (let i = 0; i < w; i += step) this.px(x + i, y, color);
  }

  /** Vertical two-stop gradient, dithered down to flat bands for a retro feel. */
  gradientV(x: number, y: number, w: number, h: number, top: string, bottom: string): void {
    const g = this.ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  /** Rounded-corner filled box (corners are single clipped pixels). */
  box(x: number, y: number, w: number, h: number, fill: string, border?: string): void {
    this.fill(x + 1, y, w - 2, h, fill);
    this.fill(x, y + 1, w, h - 2, fill);
    if (border) {
      this.hLine(x + 1, y, w - 2, border);
      this.hLine(x + 1, y + h - 1, w - 2, border);
      this.vLine(x, y + 1, h - 2, border);
      this.vLine(x + w - 1, y + 1, h - 2, border);
    }
  }

  /** Bevelled panel: light top/left edge, dark bottom/right edge. */
  panel(x: number, y: number, w: number, h: number, opts?: { fill?: string; raised?: boolean }): void {
    const fill = opts?.fill ?? C.panel;
    const raised = opts?.raised ?? true;
    this.fill(x, y, w, h, fill);
    const lightEdge = raised ? C.panelHi : C.panelLo;
    const darkEdge = raised ? C.panelLo : C.panelHi;
    this.hLine(x, y, w, lightEdge);
    this.vLine(x, y, h, lightEdge);
    this.hLine(x, y + h - 1, w, darkEdge);
    this.vLine(x + w - 1, y, h, darkEdge);
  }

  /** Progress / rating bar with a 1px frame. */
  bar(x: number, y: number, w: number, h: number, ratio: number, color: string, bg = C.panelLo): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    this.fill(x, y, w, h, bg);
    this.fill(x, y, Math.round((w - 2) * clamped) + (clamped > 0 ? 1 : 0), h, color);
    this.stroke(x, y, w, h, C.lineSoft);
  }

  // ------------------------------------------------------------------- text

  /** Draws `text` with the 5x7 bitmap font. Returns the advance width used. */
  text(text: string, x: number, y: number, color: string = C.ink, align: Align = 'left'): number {
    const w = measure(text);
    let cx = x;
    if (align === 'center') cx = Math.round(x - w / 2);
    else if (align === 'right') cx = x - w;

    this.ctx.fillStyle = color;
    for (const ch of text) {
      if (ch === ' ') {
        cx += FONT_SPACE + FONT_TRACKING;
        continue;
      }
      if (ch === '\t') {
        cx += FONT_SPACE * 2 + FONT_TRACKING;
        continue;
      }
      const g = glyphOf(ch);
      if (!g) {
        cx += FONT_SPACE + FONT_TRACKING;
        continue;
      }
      for (let ry = 0; ry < g.rows.length; ry++) {
        const row = g.rows[ry];
        let runStart = -1;
        for (let rx = 0; rx <= row.length; rx++) {
          const on = rx < row.length && row[rx] === '1';
          if (on && runStart < 0) runStart = rx;
          else if (!on && runStart >= 0) {
            this.ctx.fillRect(cx + runStart, y + ry, rx - runStart, 1);
            runStart = -1;
          }
        }
      }
      cx += g.width + FONT_TRACKING;
    }
    return w;
  }

  /** Text with a 1px drop shadow — used for headings over busy backgrounds. */
  textShadow(text: string, x: number, y: number, color = C.ink, align: Align = 'left', shadow = '#000'): number {
    this.text(text, x + 1, y + 1, shadow, align);
    return this.text(text, x, y, color, align);
  }

  /** Word-wrapped paragraph. Returns the total height drawn. */
  paragraph(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    color: string = C.ink,
    lineGap = 2,
    align: Align = 'left',
  ): number {
    const lines = wrap(text, maxWidth);
    const step = FONT_HEIGHT + lineGap;
    lines.forEach((line, i) => {
      const lx = align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x;
      this.text(line, lx, y + i * step, color, align);
    });
    return lines.length * step;
  }

  measure = measure;
  wrap = wrap;

  /** Truncates `text` with a trailing ellipsis so it fits `maxWidth` pixels. */
  ellipsize(text: string, maxWidth: number): string {
    if (maxWidth <= 0) return '';
    if (measure(text) <= maxWidth) return text;
    const dots = '…';
    const budget = maxWidth - measure(dots);
    if (budget <= 0) return dots;
    let out = '';
    for (const ch of text) {
      if (measure(out + ch) > budget) break;
      out += ch;
    }
    return `${out.trimEnd()}${dots}`;
  }

  /** Draws `text` truncated to `maxWidth`; returns the width actually used. */
  textClipped(text: string, x: number, y: number, maxWidth: number, color: string = C.ink): number {
    return this.text(this.ellipsize(text, maxWidth), x, y, color);
  }

  // ---------------------------------------------------------------- bitmaps

  /** Blits a full source canvas at integer coordinates. */
  blit(src: CanvasImageSource, x: number, y: number): void {
    this.ctx.drawImage(src, x | 0, y | 0);
  }

  /** Blits a sub-rectangle of a source canvas. */
  blitRect(
    src: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
  ): void {
    this.ctx.drawImage(src, sx, sy, sw, sh, dx | 0, dy | 0, sw, sh);
  }

  /** Blits mirrored horizontally around its own centre. */
  blitFlipped(src: CanvasImageSource, x: number, y: number, w: number): void {
    this.ctx.save();
    this.ctx.translate((x | 0) + w, y | 0);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(src, 0, 0);
    this.ctx.restore();
  }
}
