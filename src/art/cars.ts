import { drawRows, makeCanvas, ctxOf, type Palette } from './pixel.ts';

/**
 * Side-view cars for the exterior street.
 *
 * Sprites face right; the painter flips them when a car drives left.
 * Sized to read clearly on the 158px-wide street (roughly double the first draft).
 */

const TRAFFIC_COLORS = [
  { body: '#c45a3a', roof: '#e08060', glass: '#8ec4e0' },
  { body: '#4a6a8a', roof: '#6a8ab0', glass: '#a8d4f0' },
  { body: '#5a6a4a', roof: '#7a8a64', glass: '#9ec8b0' },
  { body: '#8a7a4a', roof: '#b0a060', glass: '#c8d8e8' },
  { body: '#6a5a7a', roof: '#8a7a9a', glass: '#b0c0e0' },
  { body: '#3a3a40', roof: '#5a5a62', glass: '#7a9ab0' },
] as const;

/** Facing right — ~28×14 sedan. */
const SEDAN = [
  '............rrrrrr..........',
  '..........rrrrrrrrrr........',
  '.........rrggggggggrr.......',
  '........rrggggggggggrr......',
  '......bbbbbbbbbbbbbbbbbb....',
  '....bbbbbbbbbbbbbbbbbbbbbb..',
  '...bbbbbbbbbbbbbbbbbbbbbbbb.',
  '..bbbbbbbbbbbbbbbbbbbbbbbbbb',
  '.bbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'bbb..tttt..bbbbbb..tttt..bbb',
  'bb...tttt...bbbb...tttt...bb',
  '.....tttt..........tttt.....',
  '......tt............tt......',
];

/** Facing right — taller pizza van with roof box and driver in the cabin. */
const VAN = [
  '........oooooo..............',
  '.......oPPPPPPo.............',
  '......oooooooooo............',
  '.....vvvvvvvvvvvvvv.........',
  '....vvvvvvvvvvvvvvvvccc.....',
  '...vvvvvvvvvvvvvvvcccccc....',
  '..vvvvvvvvvvvvvvvcccDDccc...',
  '.vvvvvvvvvvvvvvvvccccccccc..',
  'vvvvvvvvvvvvvvvvccccccccccc.',
  'vvvvvvvvvvvvvvvvcccccccccccc',
  'vvvvvvvvvvvvvvvvcccccccccccc',
  'vvv..tttt..vvvvvv..tttt..ccc',
  'vv...tttt...vvvv...tttt...cc',
  '.....tttt..........tttt.....',
  '......tt............tt......',
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
  const key = `t2-${Math.abs(seed) % TRAFFIC_COLORS.length}`;
  const hit = carCache.get(key);
  if (hit) return hit;
  const canvas = paint(SEDAN, {
    b: tint.body,
    r: tint.roof,
    g: tint.glass,
    t: '#1a1a1c',
  });
  carCache.set(key, canvas);
  return canvas;
}

/** Branded pizza delivery van — roof pizza box, blue cabin, visible driver. */
export function deliveryVanSprite(): HTMLCanvasElement {
  const key = 'delivery2';
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
