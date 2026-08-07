/**
 * Tiny helpers for authoring pixel art in source form.
 *
 * Sprites are written as arrays of strings, one character per pixel, and painted
 * through a palette map. `.` and ` ` are always transparent.
 */

export type Palette = Record<string, string>;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;
  return c;
}

export function ctxOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

/** Paints `rows` into a freshly allocated canvas using `palette`. */
export function sprite(rows: string[], palette: Palette): HTMLCanvasElement {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const canvas = makeCanvas(w, h);
  const ctx = ctxOf(canvas);
  drawRows(ctx, rows, palette, 0, 0);
  return canvas;
}

/** Paints `rows` into an existing context at (ox, oy). */
export function drawRows(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  palette: Palette,
  ox: number,
  oy: number,
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      const color = key === '.' || key === ' ' ? undefined : palette[key];
      if (color === undefined) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === key) run++;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, run, 1);
      x += run;
    }
  }
}

/** Returns a horizontally mirrored copy of a sprite. */
export function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = makeCanvas(src.width, src.height);
  const ctx = ctxOf(out);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return out;
}

/** Recolours a sprite by swapping exact RGB matches. Used for crowd variety. */
export function recolor(src: HTMLCanvasElement, swaps: Array<[string, string]>): HTMLCanvasElement {
  const out = makeCanvas(src.width, src.height);
  const ctx = ctxOf(out);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const map = new Map<number, [number, number, number]>();
  for (const [from, to] of swaps) map.set(packHex(from), unpackHex(to));
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const packed = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    const rep = map.get(packed);
    if (rep) {
      d[i] = rep[0];
      d[i + 1] = rep[1];
      d[i + 2] = rep[2];
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function packHex(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) & 0xffffff;
}

function unpackHex(hex: string): [number, number, number] {
  const v = packHex(hex);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}
