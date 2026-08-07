import { drawRows, makeCanvas, ctxOf, type Palette } from './pixel.ts';

/**
 * Tiny side-view cars for the exterior street.
 *
 * Sprites face right; the painter flips them when a car drives left.
 * Traffic sedans are muted city colours; the delivery van is branded and taller,
 * with a pizza box on the roof and the driver visible in the cabin.
 */

const TRAFFIC_COLORS = [
  { body: '#c45a3a', dark: '#8a3420', light: '#e08060' },
  { body: '#4a6a8a', dark: '#2e4560', light: '#6a8ab0' },
  { body: '#5a6a4a', dark: '#3a4a30', light: '#7a8a64' },
  { body: '#8a7a4a', dark: '#5c4e2e', light: '#b0a060' },
  { body: '#6a5a7a', dark: '#443850', light: '#8a7a9a' },
  { body: '#3a3a40', dark: '#1e1e22', light: '#5a5a62' },
] as const;

/** Facing right: cabin / windscreen on the right-hand side. */
const SEDAN = [
  '......wwww......',
  '.....wggggw.....',
  '....wggggggw....',
  '..bbbbbbbbbbbb..',
  '.bbbbbbbbbbbbbb.',
  'bbbbbbbbbbbbbbbb',
  'bb.tt.bbbb.tt.bb',
  '..ttt......ttt..',
];

/** Facing right: cargo bay left, blue cabin + driver right, pizza box on roof. */
const VAN = [
  '....oooo........',
  '...oPPPo........',
  '..ooooooo.......',
  '.vvvvvvvvvvv....',
  'vvvvvvvvvvvvccc.',
  'vvvvvvvvvvccDDcc',
  'vvvvvvvvvvcccccc',
  'vvvvvvvvvvcccccc',
  'vv.tt.vvvv.tt.cc',
  '..ttt......ttt..',
];

const carCache = new Map<string, HTMLCanvasElement>();

function paint(rows: string[], palette: Palette): HTMLCanvasElement {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const canvas = makeCanvas(w, h);
  drawRows(ctxOf(canvas), rows, palette, 0, 0);
  return canvas;
}

/** Ordinary passer-by car. `seed` picks the body colour. */
export function trafficCarSprite(seed: number): HTMLCanvasElement {
  const tint = TRAFFIC_COLORS[Math.abs(seed) % TRAFFIC_COLORS.length];
  const key = `t${Math.abs(seed) % TRAFFIC_COLORS.length}`;
  const hit = carCache.get(key);
  if (hit) return hit;
  const canvas = paint(SEDAN, {
    b: tint.body,
    w: tint.light,
    g: '#8ec4e0',
    t: '#1a1a1c',
  });
  carCache.set(key, canvas);
  return canvas;
}

/** Branded pizza delivery van — taller body, roof pizza box, driver in the cabin. */
export function deliveryVanSprite(): HTMLCanvasElement {
  const key = 'delivery';
  const hit = carCache.get(key);
  if (hit) return hit;
  const canvas = paint(VAN, {
    v: '#e0452c',
    c: '#2f6ea8',
    D: '#d9a173',
    o: '#ffd15c',
    P: '#e0452c',
    t: '#1a1a1c',
  });
  carCache.set(key, canvas);
  return canvas;
}
