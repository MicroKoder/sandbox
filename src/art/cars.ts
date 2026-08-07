import { drawRows, makeCanvas, ctxOf, type Palette } from './pixel.ts';

/**
 * Side-view cars for the exterior street.
 *
 * Sprites face right; the painter flips them when a car drives left.
 * The sedan is a classic three-box profile: trunk | cabin | flat hood.
 */

/** Bright body colours only — no charcoal that disappears on asphalt. */
const TRAFFIC_COLORS = [
  { body: '#d94a32', dark: '#b03824', hood: '#e86048', glass: '#7ec8e8' },
  { body: '#2f7cc8', dark: '#1e5a96', hood: '#3a8ad4', glass: '#a8dcf0' },
  { body: '#f2ead8', dark: '#d4c8b0', hood: '#fff8ec', glass: '#5aa8c8' },
  { body: '#e8b020', dark: '#c09018', hood: '#f0c840', glass: '#70b8d8' },
  { body: '#e07028', dark: '#b85418', hood: '#f08840', glass: '#80c8e8' },
  { body: '#2aaa7a', dark: '#1e8a60', hood: '#3cc090', glass: '#90d0e8' },
] as const;

/**
 * Classic three-box sedan, facing right (38×17):
 *   left  = trunk (darker, lower box)
 *   mid   = cabin / greenhouse
 *   right = long flat hood + headlight
 */
const SEDAN = [
  '..............ffffffff................',
  '............ffggggggggff..............',
  '...........ffggggggggggff.............',
  '..........ffggggggggggggff............',
  '...ddddddbbbbbbbbbbbbbbbhhhhhhhhhhhh..',
  '..dddddddbbbbbbbbbbbbbbbhhhhhhhhhhhhh.',
  '.ddddddddbbbbbbbbbbbbbbbhhhhhhhhhhhhhl',
  'dddddddddbbbbbbbbbbbbbbbhhhhhhhhhhhhhl',
  'dddddddddbbbbbbbbbbbbbbbhhhhhhhhhhhhhl',
  'bbbbbbbbbbbbbbbbbbbbbbbbhhhhhhhhhhhhhl',
  'bbbbbbbbbbbbbbbbbbbbbbbbhhhhhhhhhhhhhl',
  'bbb.......bbbbbbbbbbbb.......bbbbbbbb.',
  'bb.ttttttt.bbbbbbbbbb.ttttttt.bbbbbbb.',
  'b.ttuuuuutt.bbbbbbbb.ttuuuuutt.bbbbbb.',
  'b.ttuuuuutt.bbbbbbbb.ttuuuuutt.bbbbbb.',
  'b.ttuuuuutt.bbbbbbbb.ttuuuuutt.bbbbbb.',
  '..ttttttt............ttttttt..........',
];

/** Facing right — boxy delivery van, flat cab nose, large wheels, pizza box. */
const VAN = [
  '.........ooooooo...................',
  '........oPPPPPPPo..................',
  '.......ooooooooooo.................',
  '......vvvvvvvvvvvvvvccc............',
  '.....vvvvvvvvvvvvvvvccccc..........',
  '....vvvvvvvvvvvvvvvcccDDccc........',
  '...vvvvvvvvvvvvvvvvccccccccc.......',
  '..vvvvvvvvvvvvvvvvccccccccccc......',
  '.vvvvvvvvvvvvvvvvvcccccccccccc.....',
  'vvvvvvvvvvvvvvvvvvccccccccccccc....',
  'vvvvvvvvvvvvvvvvvvccccccccccccccl..',
  'vvvvvvvvvvvvvvvvvvccccccccccccccl..',
  'vv.......vvvvvvvv.......ccccccccc..',
  'vv.ttttttt.vvvvvv.ttttttt.ccccccc..',
  'v.ttuuuuutt.vvvv.ttuuuuutt.cccccc..',
  'v.ttuuuuutt.vvvv.ttuuuuutt.cccccc..',
  'v.ttuuuuutt.vvvv.ttuuuuutt.cccccc..',
  '..ttttttt..........ttttttt.........',
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
  const key = `t5-${Math.abs(seed) % TRAFFIC_COLORS.length}`;
  const hit = carCache.get(key);
  if (hit) return hit;
  const canvas = paint(SEDAN, {
    b: tint.body,
    d: tint.dark,
    h: tint.hood,
    f: tint.dark,
    g: tint.glass,
    t: '#1a1410',
    u: '#d0c8b8',
    l: '#ffe9a8',
  });
  carCache.set(key, canvas);
  return canvas;
}

/** Branded pizza delivery van — roof pizza box, blue cabin, visible driver. */
export function deliveryVanSprite(): HTMLCanvasElement {
  const key = 'delivery5';
  const hit = carCache.get(key);
  if (hit) return hit;
  const canvas = paint(VAN, {
    v: '#e0452c',
    c: '#2f6ea8',
    D: '#d9a173',
    o: '#ffd15c',
    P: '#e0452c',
    t: '#1a1410',
    u: '#d0c8b8',
    l: '#ffe9a8',
  });
  carCache.set(key, canvas);
  return canvas;
}
