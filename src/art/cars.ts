import { drawRows, makeCanvas, ctxOf, type Palette } from './pixel.ts';

/**
 * Side-view cars for the exterior street.
 *
 * Sprites face right; the painter flips them when a car drives left.
 * Sedans use a flat hood, a clear cabin, and oversized wheels so they read on
 * the dark asphalt. Colours are kept bright so nothing blends into the road.
 */

/** Bright body colours only — no charcoal / olive that disappears on asphalt. */
const TRAFFIC_COLORS = [
  { body: '#d94a32', roof: '#f07050', hood: '#e85840', glass: '#7ec8e8' },
  { body: '#2f7cc8', roof: '#4a96e0', hood: '#3a8ad4', glass: '#a8dcf0' },
  { body: '#f2ead8', roof: '#fffaf0', hood: '#f8f2e4', glass: '#5aa8c8' },
  { body: '#e8b020', roof: '#f0c840', hood: '#f0bc30', glass: '#70b8d8' },
  { body: '#e07028', roof: '#f08840', hood: '#e87c30', glass: '#80c8e8' },
  { body: '#2aaa7a', roof: '#3cc090', hood: '#34b484', glass: '#90d0e8' },
] as const;

/**
 * Facing right — flat hood at the front (right), cabin mid-body, trunk aft.
 * Wheels are chunky 6×5 blocks with a hub so they don't read as ticks.
 */
const SEDAN = [
  '.............rrrrrrr..............',
  '...........rrrggggggrrr............',
  '..........rrggggggggggrr...........',
  '.........rrgggggggggggrr...........',
  '........bbbbbbbbbbbbbbbhhhh........',
  '.......bbbbbbbbbbbbbbbbhhhhh.......',
  '......bbbbbbbbbbbbbbbbbhhhhhh......',
  '.....bbbbbbbbbbbbbbbbbbhhhhhhh.....',
  '....bbbbbbbbbbbbbbbbbbbhhhhhhhh....',
  '...bbbbbbbbbbbbbbbbbbbbhhhhhhhhh...',
  '..bbbbbbbbbbbbbbbbbbbbbhhhhhhhhhhl.',
  '.bbbbbbbbbbbbbbbbbbbbbbhhhhhhhhhhhl',
  'bb.tttttt.bbbbbbbbbb.tttttt.bbbbbbb',
  'b.ttuuuutt.bbbbbbbb.ttuuuutt.bbbbbb',
  'b.ttuuuutt.bbbbbbbb.ttuuuutt.bbbbbb',
  '..tttttt............tttttt.........',
];

/** Facing right — boxy delivery van, flat cab nose, large wheels, pizza box. */
const VAN = [
  '.........ooooooo..................',
  '........oPPPPPPPo.................',
  '.......ooooooooooo................',
  '......vvvvvvvvvvvvvvccc...........',
  '.....vvvvvvvvvvvvvvvccccc.........',
  '....vvvvvvvvvvvvvvvcccDDccc.......',
  '...vvvvvvvvvvvvvvvvccccccccc......',
  '..vvvvvvvvvvvvvvvvccccccccccc.....',
  '.vvvvvvvvvvvvvvvvvcccccccccccc....',
  'vvvvvvvvvvvvvvvvvvccccccccccccc...',
  'vvvvvvvvvvvvvvvvvvccccccccccccccl.',
  'vvvvvvvvvvvvvvvvvvccccccccccccccl.',
  'vv.tttttt.vvvvvvvv.tttttt.ccccccc.',
  'v.ttuuuutt.vvvvvv.ttuuuutt.cccccc.',
  'v.ttuuuutt.vvvvvv.ttuuuutt.cccccc.',
  '..tttttt...........tttttt.........',
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
  const key = `t3-${Math.abs(seed) % TRAFFIC_COLORS.length}`;
  const hit = carCache.get(key);
  if (hit) return hit;
  const canvas = paint(SEDAN, {
    b: tint.body,
    r: tint.roof,
    h: tint.hood,
    g: tint.glass,
    t: '#1a1410',
    u: '#c8c0b0',
    l: '#ffe9a8',
  });
  carCache.set(key, canvas);
  return canvas;
}

/** Branded pizza delivery van — roof pizza box, blue cabin, visible driver. */
export function deliveryVanSprite(): HTMLCanvasElement {
  const key = 'delivery3';
  const hit = carCache.get(key);
  if (hit) return hit;
  const canvas = paint(VAN, {
    v: '#e0452c',
    c: '#2f6ea8',
    D: '#d9a173',
    o: '#ffd15c',
    P: '#e0452c',
    t: '#1a1410',
    u: '#c8c0b0',
    l: '#ffe9a8',
  });
  carCache.set(key, canvas);
  return canvas;
}
