import { drawRows, makeCanvas, ctxOf, type Palette } from './pixel.ts';

/**
 * Procedural 9x19 character sprites for visitors and staff.
 *
 * Everything is composed from a shared body template plus a head-wear layer, so
 * a whole crowd of distinguishable people costs almost nothing to author.
 */

export type Pose = 'stand' | 'walk1' | 'walk2' | 'sit';

export interface PersonLook {
  skin: string;
  hair: string;
  shirt: string;
  shirtDark: string;
  trousers: string;
  shoes: string;
  /** Optional head-wear drawn on top of the hair. */
  hat?: 'chef' | 'cap' | 'bow' | 'shades' | 'bun';
  hatColor?: string;
}

export const PERSON_W = 9;
export const PERSON_H = 19;

const HEAD = [
  '...hhh...',
  '..hhhhh..',
  '.hhhhhhh.',
  '.ksssssk.',
  '..seses..',
  '..sssss..',
  '..smmms..',
  '...ttt...',
];

const TORSO = [
  '..ccccc..',
  '.ccccccc.',
  'scccccccs',
  '.ccccccc.',
  '.cbbbbbc.',
];

const LEGS: Record<Pose, string[]> = {
  stand: ['..ppppp..', '..pp.pp..', '..pp.pp..', '..pp.pp..', '.fff.fff.', '.........'],
  walk1: ['..ppppp..', '..pp.pp..', '.pp...pp.', '.pp...pp.', 'fff...fff', '.........'],
  walk2: ['..ppppp..', '..ppppp..', '..pp.pp..', '..pp.pp..', '..ff.ff..', '.........'],
  sit: ['..ppppp..', '.ppppppp.', '.pp...pp.', '.ff...ff.', '.........', '.........'],
};

function paletteFor(look: PersonLook): Palette {
  return {
    h: look.hair,
    s: look.skin,
    k: shade(look.skin, -18),
    e: '#241812',
    m: shade(look.skin, -34),
    t: shade(look.skin, -10),
    c: look.shirt,
    b: look.shirtDark,
    p: look.trousers,
    f: look.shoes,
    w: look.hatColor ?? '#f6f0e2',
    d: shade(look.hatColor ?? '#f6f0e2', -30),
  };
}

/** Lightens (positive) or darkens (negative) a hex colour by `amount` steps. */
export function shade(hex: string, amount: number): string {
  const v = parseInt(hex.slice(1), 16);
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const r = clamp(((v >> 16) & 0xff) + amount);
  const g = clamp(((v >> 8) & 0xff) + amount);
  const b = clamp((v & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const HATS: Record<NonNullable<PersonLook['hat']>, { rows: string[]; y: number }> = {
  chef: { rows: ['..wwwww..', '.wwwwwww.', '..ddddd..'], y: 0 },
  cap: { rows: ['..wwww...', '.wwwwww..', '.ddddddd.'], y: 0 },
  bow: { rows: ['...wdw...'], y: 8 },
  shades: { rows: ['..eeeee..'], y: 4 },
  bun: { rows: ['...ww....', '..wwww...'], y: 0 },
};

export function drawPerson(
  ctx: CanvasRenderingContext2D,
  look: PersonLook,
  pose: Pose,
  ox = 0,
  oy = 0,
): void {
  const pal = paletteFor(look);
  drawRows(ctx, HEAD, pal, ox, oy);
  drawRows(ctx, TORSO, pal, ox, oy + 8);
  drawRows(ctx, LEGS[pose], pal, ox, oy + 13);
  if (look.hat) {
    const hat = HATS[look.hat];
    drawRows(ctx, hat.rows, pal, ox, oy + hat.y);
  }
}

export function personSprite(look: PersonLook, pose: Pose): HTMLCanvasElement {
  const canvas = makeCanvas(PERSON_W, PERSON_H);
  drawPerson(ctxOf(canvas), look, pose, 0, 0);
  return canvas;
}

// ------------------------------------------------------------------- looks

const SKINS = ['#e8b98d', '#d9a173', '#c78a5c', '#f0c9a5', '#a86f45'];
const HAIRS = ['#3a2418', '#6b4226', '#1d1512', '#8d6a3f', '#c2903f', '#8a8a92'];
const SHIRTS = [
  '#c44a3a',
  '#4a7fc4',
  '#5aa04a',
  '#c9a03a',
  '#8a54b0',
  '#3aa89a',
  '#c46a9a',
  '#7a6a58',
];
const TROUSERS = ['#3b3f52', '#4a3a2c', '#2f2f36', '#54463a', '#3a4a3a'];

/** Deterministically derives a visitor's appearance from a seed. */
export function visitorLook(seed: number): PersonLook {
  const s = Math.abs(Math.floor(seed));
  const shirt = SHIRTS[s % SHIRTS.length];
  return {
    skin: SKINS[(s >> 3) % SKINS.length],
    hair: HAIRS[(s >> 5) % HAIRS.length],
    shirt,
    shirtDark: shade(shirt, -28),
    trousers: TROUSERS[(s >> 7) % TROUSERS.length],
    shoes: '#241a14',
    ...(s % 7 === 0 ? { hat: 'bun' as const, hatColor: HAIRS[(s >> 5) % HAIRS.length] } : {}),
  };
}

/** Uniform looks for the five kinds of employee. */
export const STAFF_LOOKS: PersonLook[] = [
  // повар
  {
    skin: '#e8b98d',
    hair: '#3a2418',
    shirt: '#f2ece0',
    shirtDark: '#d3cbbc',
    trousers: '#6f6f78',
    shoes: '#241a14',
    hat: 'chef',
    hatColor: '#f6f0e2',
  },
  // официант
  {
    skin: '#e0ab7c',
    hair: '#221812',
    shirt: '#2f3542',
    shirtDark: '#1e2430',
    trousers: '#1e2430',
    shoes: '#141014',
    hat: 'bow',
    hatColor: '#c44a3a',
  },
  // курьер
  {
    skin: '#d9a173',
    hair: '#6b4226',
    shirt: '#3f6ea8',
    shirtDark: '#2c5182',
    trousers: '#33415a',
    shoes: '#241a14',
    hat: 'cap',
    hatColor: '#2c5182',
  },
  // уборщик
  {
    skin: '#c78a5c',
    hair: '#4a3a2c',
    shirt: '#5f8f4f',
    shirtDark: '#456c39',
    trousers: '#4a5340',
    shoes: '#241a14',
    hat: 'cap',
    hatColor: '#456c39',
  },
  // охранник
  {
    skin: '#a86f45',
    hair: '#1d1512',
    shirt: '#26262c',
    shirtDark: '#17171b',
    trousers: '#17171b',
    shoes: '#0f0f12',
    hat: 'shades',
  },
];
