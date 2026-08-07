import { sprite, type Palette } from './pixel.ts';

/**
 * Icon set: tab-strip glyphs, visitor mood faces and item thumbnails.
 * All hand-plotted; nothing is taken from the original jar.
 */

const UI: Palette = {
  o: '#1a120c',
  l: '#f3e4c8',
  m: '#c9a06a',
  d: '#8a5f34',
  r: '#d4402c',
  y: '#ffc84a',
  g: '#79b04a',
  b: '#5cb6e8',
  w: '#ffffff',
  k: '#4a3527',
  s: '#9aa0a8',
};

export const TAB_ICON_W = 14;
export const TAB_ICON_H = 12;

/** One 14x12 glyph per gameplay tab, in tab order. */
const TAB_ICON_ROWS: string[][] = [
  // 0 — пиццерия
  [
    '.....oo.......',
    '....oyyo......',
    '...oyyyyo.....',
    '..oooooooo....',
    '..orororo.....',
    '..oooooooo....',
    '..oddddddo....',
    '..od.ll.do....',
    '..od.ll.do....',
    '..oddddddo....',
    '..od.oo.do....',
    '..oooooooo....',
  ],
  // 1 — цены в меню
  [
    '.......ooooo..',
    '......oyyyyo..',
    '.....oyoyyyo..',
    '....oyyoyyyo..',
    '...oyyyyoyyo..',
    '..oyyyyyyoyo..',
    '.oyyyyyyyyoo..',
    '..oyyyyyyyo...',
    '...oyyyyyo....',
    '....oyyyo.....',
    '.....ooo......',
    '..............',
  ],
  // 2 — рецепты
  [
    '..oooooooooo..',
    '..ollllllllo..',
    '..ol.oooo.lo..',
    '..ol.llll.lo..',
    '..ol.oooo.lo..',
    '..ol.llll.lo..',
    '..ol.oooo.lo..',
    '..ol.llll.lo..',
    '..ol.oooo.lo..',
    '..ollllllllo..',
    '..oooooooooo..',
    '..............',
  ],
  // 3 — ингредиенты
  [
    '..............',
    '..oooooooooo..',
    '..okkkkkkkko..',
    '..okooooooko..',
    '..okommmmoko..',
    '..okommmmoko..',
    '..okommmmoko..',
    '..okooooooko..',
    '..okkkkkkkko..',
    '..oooooooooo..',
    '..............',
    '..............',
  ],
  // 4 — продукты
  [
    '....oo........',
    '....obo.......',
    '...oobooo.....',
    '...obbbbo.....',
    '...obbbbo..oo.',
    '...obbbbo.olo.',
    '...obbbbo.olo.',
    '...obbbbo.olo.',
    '...obbbbo..oo.',
    '...oooooo.....',
    '..............',
    '..............',
  ],
  // 5 — реклама
  [
    '...o.....o....',
    '....o...o.....',
    '.....o.o......',
    '..oooooooooo..',
    '..obbbbbbbbo..',
    '..obwwwwwwbo..',
    '..obwwwwwwbo..',
    '..obbbbbbbbo..',
    '..oooooooooo..',
    '...o......o...',
    '..............',
    '..............',
  ],
  // 6 — статистика
  [
    '..o...........',
    '..o.......gg..',
    '..o.......gg..',
    '..o.......gg..',
    '..o...yy..gg..',
    '..o...yy..gg..',
    '..o...yy..gg..',
    '..orr.yy..gg..',
    '..orr.yy..gg..',
    '..orr.yy..gg..',
    '..oooooooooo..',
    '..............',
  ],
  // 7 — карта
  [
    '..oooooooooo..',
    '..oggggggggo..',
    '..ogglgggggo..',
    '..ogglgggggo..',
    '..ollllllllo..',
    '..ogglgggggo..',
    '..ogglgggggo..',
    '..oggggggggo..',
    '..oooooooooo..',
    '..............',
    '..............',
    '..............',
  ],
  // 8 — модернизация
  [
    '.........oo...',
    '........osso..',
    '........osso..',
    '.......osso...',
    '......osso....',
    '.....osso.....',
    '....osso......',
    '...osso.......',
    '..osso........',
    '..osso........',
    '..oso.........',
    '..............',
  ],
  // 9 — автоматы
  [
    '..oooooooo....',
    '..obbbbbbo....',
    '..obwwwwbo....',
    '..obwwwwbo....',
    '..obbbbbbo....',
    '..oyyoyyoo....',
    '..oyyoyyoo....',
    '..obbbbbbo....',
    '..oboooobo....',
    '..obbbbbbo....',
    '..oooooooo....',
    '..............',
  ],
  // 10 — сотрудники
  [
    '.....oooo.....',
    '....owwwwo....',
    '....omoomo....',
    '....owwwwo....',
    '.....oooo.....',
    '...oobbboo....',
    '..obbbbbbbo...',
    '..obbbbbbbo...',
    '..obbbbbbbo...',
    '...ob...bo....',
    '...oo...oo....',
    '..............',
  ],
];

let tabIcons: HTMLCanvasElement[] | null = null;

export function getTabIcons(): HTMLCanvasElement[] {
  if (!tabIcons) tabIcons = TAB_ICON_ROWS.map((rows) => sprite(rows, UI));
  return tabIcons;
}

// -------------------------------------------------------------- mood faces

export const MOOD_ICON_SIZE = 9;

interface MoodFace {
  color: string;
  /** Row 3 — eyebrows. */
  brow: string;
  /** Row 4 — eyes. */
  eyes: string;
  /** Row 6 — mouth. */
  mouth: string;
}

const MOOD_FACES: MoodFace[] = [
  // 0 доволен
  { color: '#8fc46a', brow: 'offfffffo', eyes: 'ofXfffXfo', mouth: 'ofXXXXXfo' },
  // 1 ухмылка (слишком дорого)
  { color: '#e2c85a', brow: 'offfffffo', eyes: 'ofXfffXfo', mouth: 'offfXXXfo' },
  // 2 недоволен (малый выбор)
  { color: '#e0a248', brow: 'offfffffo', eyes: 'ofXfffXfo', mouth: 'offXXXffo' },
  // 3 злой (недостаток товара)
  { color: '#e0452c', brow: 'ofXfffXfo', eyes: 'offXfXffo', mouth: 'offXXXffo' },
  // 4 плохое поведение (пьяный)
  { color: '#a45cd0', brow: 'offfffffo', eyes: 'ofXfXfXfo', mouth: 'offfXXffo' },
  // 5 плохо (отравлен)
  { color: '#7fb37f', brow: 'offfffffo', eyes: 'ofXfffXfo', mouth: 'ofXfXfXfo' },
  // 6 напуган (случилось ЧП)
  { color: '#5cb6e8', brow: 'offfffffo', eyes: 'ofXXfXXfo', mouth: 'offXXXffo' },
  // 7 недоволен (не обслужили)
  { color: '#a8a29a', brow: 'offfffffo', eyes: 'ofXfffXfo', mouth: 'ofXXXXXfo' },
];

function moodSprite(face: MoodFace): HTMLCanvasElement {
  const rows = [
    '...ooo...',
    '.oofffoo.',
    '.offfffo.',
    face.brow,
    face.eyes,
    'offfffffo',
    face.mouth,
    '.offfffo.',
    '...ooo...',
  ];
  return sprite(rows, { o: '#1a120c', f: face.color, X: '#241812' });
}

let moodIcons: HTMLCanvasElement[] | null = null;

export function getMoodIcons(): HTMLCanvasElement[] {
  if (!moodIcons) moodIcons = MOOD_FACES.map(moodSprite);
  return moodIcons;
}

// ------------------------------------------------------------------- pizza

export const PIZZA_ICON_SIZE = 13;

const PIZZA_PAL: Palette = {
  o: '#8a5320',
  c: '#e9b45c',
  s: '#ffd88a',
};

const PIZZA_ROWS = [
  '....ooooo....',
  '..oocccccoo..',
  '.occcsssccco.',
  'occssssssscco',
  'ocsssssssssco',
  'ocsssssssssco',
  'ocsssssssssco',
  'ocsssssssssco',
  'ocsssssssssco',
  'occssssssscco',
  '.occcsssccco.',
  '..oocccccoo..',
  '....ooooo....',
];

/** Colour scattered onto a pizza thumbnail for each ingredient index. */
export const INGREDIENT_COLORS: string[] = [
  '#e9b45c', // 0  тесто пресное
  '#dda85a', // 1  тесто сдобное
  '#e6c07a', // 2  тесто слоёное
  '#ffd15c', // 3  сыр честер
  '#e8dc9a', // 4  сыр алтай
  '#f2e2a8', // 5  сыр пармезан
  '#f5efd8', // 6  майонез
  '#d4402c', // 7  томатный соус
  '#7d9c3a', // 8  оливковый соус
  '#c98a5a', // 9  мясо курицы
  '#e0523a', // 10 помидоры
  '#8a6a4a', // 11 белые грибы
  '#b09a7a', // 12 шампиньоны
  '#d98a7a', // 13 ветчина
  '#c46a55', // 14 бекон
  '#f2a07a', // 15 креветки
  '#c9846a', // 16 тунец
  '#e08a6a', // 17 сёмга
  '#8a7a5a', // 18 анчоусы
  '#8fc46a', // 19 киви
  '#f2d05c', // 20 ананасы
  '#4a5a3a', // 21 оливки
];

/** Builds a top-down pizza thumbnail dotted with the recipe's topping colours. */
export function pizzaSprite(ingredientIndices: number[], seedBase: number): HTMLCanvasElement {
  const canvas = sprite(PIZZA_ROWS, PIZZA_PAL);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Skip the dough (always first) — it is the crust, not a topping.
  const toppings = ingredientIndices.slice(1).map((i) => INGREDIENT_COLORS[i] ?? '#c44a3a');
  if (toppings.length === 0) return canvas;

  let seed = seedBase * 977 + 13;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 3.7;
    const x = Math.round(6 + Math.cos(a) * r);
    const y = Math.round(6 + Math.sin(a) * r);
    ctx.fillStyle = toppings[i % toppings.length];
    ctx.fillRect(x, y, 2, 1);
  }
  return canvas;
}

// ---------------------------------------------------------------- products

const PRODUCT_SHAPES = ['can', 'can', 'cup', 'cup', 'bottle', 'bottle', 'bottle', 'pack', 'pack', 'carton', 'carton', 'cone'] as const;

const PRODUCT_TINTS = [
  '#d4402c', '#c8d0d6', '#c9843a', '#8a5a2c', '#e8d27a',
  '#8a4a2c', '#d9a83a', '#e2e2e2', '#7fc4d0', '#d9c44a',
  '#c4404a', '#f2dcc0',
];

const SHAPE_ROWS: Record<(typeof PRODUCT_SHAPES)[number], string[]> = {
  can: ['.ooo.', 'ollo.', 'otto.', 'otto.', 'otto.', 'otto.', 'otto.', '.ooo.'],
  cup: ['ooooo', 'ottto', 'ottto', 'ottto', '.ooto', '.otto', '..ooo', '.....'],
  bottle: ['..o..', '..o..', '.ooo.', '.oto.', '.oto.', '.oto.', '.oto.', '.ooo.'],
  pack: ['ooooo', 'otlto', 'otlto', 'otlto', 'otlto', 'otlto', 'ooooo', '.....'],
  carton: ['.ooo.', 'ooooo', 'otlto', 'otlto', 'otlto', 'otlto', 'ooooo', '.....'],
  cone: ['.ttt.', 'ottto', '.ooo.', '.ooo.', '..o..', '..o..', '.....', '.....'],
};

let productIcons: HTMLCanvasElement[] | null = null;

export function getProductIcons(): HTMLCanvasElement[] {
  if (!productIcons) {
    productIcons = PRODUCT_SHAPES.map((shape, i) =>
      sprite(SHAPE_ROWS[shape], { o: '#1a120c', t: PRODUCT_TINTS[i], l: '#f6efe0' }),
    );
  }
  return productIcons;
}

// ---------------------------------------------------------------- machines

const MACHINE_ROWS = [
  'oooooooo',
  'obbbbbbo',
  'obwwwwbo',
  'obwwwwbo',
  'obbbbbbo',
  'obtbtbbo',
  'obtbtbbo',
  'obbbbbbo',
  'oboooobo',
  'obbbbbbo',
  'oooooooo',
];

const MACHINE_TINTS = ['#8a5a2c', '#3f8ec4', '#a83a3a', '#4a8a5a', '#a45cd0', '#c98a2c'];

let machineIcons: HTMLCanvasElement[] | null = null;

export function getMachineIcons(): HTMLCanvasElement[] {
  if (!machineIcons) {
    machineIcons = MACHINE_TINTS.map((tint) =>
      sprite(MACHINE_ROWS, { o: '#1a120c', b: tint, w: '#d8e4ea', t: '#ffd15c' }),
    );
  }
  return machineIcons;
}

// -------------------------------------------------------------- misc glyphs

/** The 5x5 selection cursor drawn to the left of the active list row. */
export const CURSOR_SPRITE = (): HTMLCanvasElement =>
  sprite(['o....', 'oo...', 'ooo..', 'oooo.', 'ooo..', 'oo...', 'o....'], { o: '#ffc84a' });

/** Small coin used next to money readouts. */
export const COIN_SPRITE = (): HTMLCanvasElement =>
  sprite(['.ooo.', 'oyyyo', 'oyoyo', 'oyyyo', '.ooo.'], { o: '#8a5f14', y: '#ffc84a' });

/** Question-mark badge shown when the current screen has a help page. */
export const HINT_SPRITE = (): HTMLCanvasElement =>
  sprite(
    ['.ooo.', 'o...o', 'o..oo', '...o.', '...o.', '.....', '...o.'],
    { o: '#ffc84a' },
  );
