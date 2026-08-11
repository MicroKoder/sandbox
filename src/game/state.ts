import { INGREDIENTS, PIZZAS, PRODUCTS, MACHINES, UPGRADES, ADS, STAFF_NAMES, UPGRADE_SECOND_FLOOR, UPGRADE_TABLES, recipePrice } from '../data/content.ts';
import { MISSIONS, type Mission } from '../data/missions.ts';
import { Rng } from './rng.ts';

// --------------------------------------------------------------- time model

/** 10 ticks make a game minute (C.java:2525). */
export const TICKS_PER_MINUTE = 10;
export const TICKS_PER_HOUR = 600;
export const TICKS_PER_DAY = 14400;

/** 07:15 — the "ОТКРЫТО" sign lights up. */
export const TICK_OPEN = 4350;
/** 08:00 — the first customer may walk in. */
export const TICK_FIRST_CUSTOMER = 4800;
/** 20:00 — the last customer may walk in. */
export const TICK_LAST_CUSTOMER = 12000;
/** 20:15 — salaries are deducted. */
export const TICK_SALARY = 12150;

/** Ticks advanced per rendered frame for each of the four speed settings. */
export const SPEED_TICKS = [0, 1, 4, 12] as const;

export type Difficulty = 0 | 1 | 2;
export type Speed = 0 | 1 | 2 | 3;

// -------------------------------------------------------------------- staff

export interface Candidate {
  /** Index into STAFF_NAMES; also the person's identity. */
  slot: number;
  type: number;
  speed: number;
  skill: number;
  hired: boolean;
}

/** Daily wage — `speed² * 37 + skill² * 43` (C.java:4639). */
export const wageOf = (c: { speed: number; skill: number }): number =>
  c.speed * c.speed * 37 + c.skill * c.skill * 43;

// -------------------------------------------------------------------- state

export type Ending = 'win' | 'time' | 'bankrupt' | 'rating' | null;

export interface Profits {
  pizza: number;
  product: number;
  machine: number;
  delivery: number;
}

export interface GameState {
  playerName: string;
  difficulty: Difficulty;
  campaign: boolean;
  missionIndex: number;

  money: number;
  /** Rating in thousandths of a percent: 100000 = 100.000 %. */
  rating: number;
  rivalRating: [number, number];
  /** Asset value `M` — the multiplier behind almost every payout. */
  assets: number;
  /** `100 - tax%`; income is multiplied by this over 100. */
  netPct: number;

  day: number;
  tick: number;
  speed: Speed;
  open: boolean;

  pizzaPrice: number[];
  pizzaStock: number[];
  productPrice: number[];
  productStock: number[];
  ingredientSupplied: boolean[];
  ingredientStock: number[];

  upgrades: boolean[];
  machines: boolean[];
  ads: boolean[];

  candidates: Candidate[];

  /** Per-day running totals, reset at midnight. */
  profits: Profits;
  /** Money and rating at the start of the current day, for the delta readout. */
  dayStartMoney: number;
  dayStartRating: number;
  /** Pizzas sold today — shown on the statistics screen. */
  soldToday: number;
  /** How many visitors left with each of the eight moods today. */
  moods: number[];

  ending: Ending;
  /** Litter dropped on the floor; each item is a position in interior pixels. */
  litter: Array<{ x: number; y: number; kind: number }>;
  /** Ticks until the next delivery run completes. */
  deliveryTimer: number;
  /** Rolling log of recent events shown on the pizzeria screen. */
  ticker: string[];
}

export function missionOf(s: GameState): Mission {
  return MISSIONS[s.missionIndex];
}

// --------------------------------------------------------------- derived

/** `var_byte_c` — the prestige multiplier `(M + rating) / 19000` (C.java:2515). */
export function scaleOf(s: GameState): number {
  return Math.max(1, Math.floor((s.assets + s.rating) / 19000));
}

/** Maximum number of live people inside the pizzeria (C.java:1650). */
export function entityCap(s: GameState): number {
  return 9 + Math.floor(s.missionIndex / 5);
}

/** Hires allowed per staff type — doubled by the second floor (C.java:2904). */
export function hireCap(s: GameState): number {
  return s.upgrades[UPGRADE_SECOND_FLOOR] ? 2 : 1;
}

export const taxPercent = (s: GameState): number => 100 - s.netPct;

export const hiredOf = (s: GameState, type: number): Candidate[] =>
  s.candidates.filter((c) => c.hired && c.type === type);

export const marketOf = (s: GameState, type: number): Candidate[] =>
  s.candidates.filter((c) => !c.hired && c.type === type);

/** Sum of a stat across every hired employee of a type. */
export function staffStat(s: GameState, type: number, stat: 'speed' | 'skill'): number {
  return hiredOf(s, type).reduce((sum, c) => sum + c[stat], 0);
}

export const dailySalary = (s: GameState): number =>
  s.candidates.reduce((sum, c) => (c.hired ? sum + wageOf(c) : sum), 0);

export const dailyAdCost = (s: GameState): number =>
  s.ads.reduce((sum, on, i) => (on ? sum + ADS[i].dayCost : sum), 0);

export const hasTables = (s: GameState): boolean => s.upgrades[UPGRADE_TABLES];

/** Pizzas that could still be baked from what is in the warehouse. */
export function bakeableCount(s: GameState, pizzaIndex: number): number {
  const p = PIZZAS[pizzaIndex];
  let min = Infinity;
  p.ingredients.forEach((ing, i) => {
    min = Math.min(min, Math.floor(s.ingredientStock[ing] / p.amounts[i]));
  });
  return Number.isFinite(min) ? min : 0;
}

export const ownedRecipes = (s: GameState): number[] =>
  missionOf(s).recipes.filter((i) => s.pizzaPrice[i] > 0);

export const buyableRecipes = (s: GameState): number[] =>
  missionOf(s).recipes.filter((i) => s.pizzaPrice[i] === 0);

export const suppliedProducts = (s: GameState): number[] =>
  missionOf(s).products.filter((i) => s.productPrice[i] > 0);

export const unsuppliedProducts = (s: GameState): number[] =>
  missionOf(s).products.filter((i) => s.productPrice[i] === 0);

/** Ingredients used by at least one owned recipe. */
export function neededIngredients(s: GameState): number[] {
  const set = new Set<number>();
  for (const r of ownedRecipes(s)) for (const ing of PIZZAS[r].ingredients) set.add(ing);
  return [...set].sort((a, b) => a - b);
}

export const suppliedIngredients = (s: GameState): number[] =>
  neededIngredients(s).filter((i) => s.ingredientSupplied[i]);

export const unsuppliedIngredients = (s: GameState): number[] =>
  neededIngredients(s).filter((i) => !s.ingredientSupplied[i]);

export const availableAds = (s: GameState): number[] => missionOf(s).ads;
export const runningAds = (s: GameState): number[] => availableAds(s).filter((i) => s.ads[i]);
export const idleAds = (s: GameState): number[] => availableAds(s).filter((i) => !s.ads[i]);

export const installedUpgrades = (s: GameState): number[] =>
  UPGRADES.map((_, i) => i).filter((i) => s.upgrades[i]);
export const pendingUpgrades = (s: GameState): number[] =>
  UPGRADES.map((_, i) => i).filter((i) => !s.upgrades[i]);

/** Only the first five machines were ever offered by the original UI. */
export const OFFERED_MACHINES = [0, 1, 2, 3, 4];
export const installedMachines = (s: GameState): number[] =>
  OFFERED_MACHINES.filter((i) => s.machines[i]);
export const pendingMachines = (s: GameState): number[] =>
  OFFERED_MACHINES.filter((i) => !s.machines[i]);

// --------------------------------------------------------------- clock text

/**
 * Rain comes in ~3-hour slots. About one slot in four is wet, so gutters and
 * grey skies show up often enough to notice without owning every afternoon.
 */
export function isRaining(s: GameState): boolean {
  const slot = s.day * 8 + Math.floor(s.tick / (TICKS_PER_HOUR * 3));
  // Cheap deterministic mix; avoids needing extra save state.
  const mix = Math.imul(slot ^ (s.day * 31), 1103515245) >>> 0;
  return mix % 4 === 0;
}

export function clockOf(s: GameState): string {
  const hour = Math.floor(s.tick / TICKS_PER_HOUR);
  const minute = Math.floor((s.tick % TICKS_PER_HOUR) / TICKS_PER_MINUTE);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// ------------------------------------------------------------ construction

/**
 * Fills the twenty job-market slots (C.java:3530). Stats start at
 * `1 + mission / 4` so later missions offer better people, and no more than
 * four candidates share a profession.
 */
function makeCandidates(missionIndex: number, rng: Rng): Candidate[] {
  const floor = 1 + Math.floor(missionIndex / 4);
  const counts = [0, 0, 0, 0, 0];
  const slots = STAFF_NAMES.map((_, i) => i);
  // Shuffle so the same names do not always get the same jobs.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const out: Candidate[] = [];
  let prevSpeed = -1;
  let prevSkill = -1;
  for (const slot of slots) {
    let speed = 0;
    let skill = 0;
    do {
      speed = rng.int(floor, 5);
      skill = rng.int(floor, 5);
    } while (speed === prevSpeed && skill === prevSkill);
    prevSpeed = speed;
    prevSkill = skill;

    let type = rng.int(0, 4);
    if (counts[type] >= 4) {
      const free = counts.findIndex((c) => c < 4);
      type = free < 0 ? type : free;
    }
    counts[type]++;
    out.push({ slot, type, speed, skill, hired: false });
  }
  return out.sort((a, b) => a.slot - b.slot);
}

export interface NewGameOptions {
  playerName: string;
  difficulty: Difficulty;
  campaign: boolean;
  missionIndex: number;
}

export function createGame(opts: NewGameOptions, rng: Rng): GameState {
  const m = MISSIONS[opts.missionIndex];
  const state: GameState = {
    playerName: opts.playerName,
    difficulty: opts.difficulty,
    campaign: opts.campaign,
    missionIndex: opts.missionIndex,

    money: m.money,
    rating: m.rating,
    rivalRating: [m.rival1Rating, m.rival2Rating],
    assets: m.assets,
    netPct: m.netPct - 5 * opts.difficulty,

    day: 0,
    tick: 0,
    speed: 1,
    open: false,

    pizzaPrice: PIZZAS.map(() => 0),
    pizzaStock: PIZZAS.map(() => 0),
    productPrice: PRODUCTS.map(() => 0),
    productStock: PRODUCTS.map(() => 0),
    ingredientSupplied: INGREDIENTS.map(() => false),
    ingredientStock: INGREDIENTS.map(() => 0),

    upgrades: UPGRADES.map(() => false),
    machines: MACHINES.map(() => false),
    ads: ADS.map(() => false),

    candidates: makeCandidates(opts.missionIndex, rng),

    profits: { pizza: 0, product: 0, machine: 0, delivery: 0 },
    dayStartMoney: m.money,
    dayStartRating: m.rating,
    soldToday: 0,
    moods: new Array(8).fill(0),

    ending: null,
    litter: [],
    deliveryTimer: rng.int(100, 200),
    ticker: [],
  };
  return state;
}

// ------------------------------------------------------------------ actions

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const NO_MONEY: ActionResult = { ok: false, message: 'У ВАС НЕДОСТАТОЧНО ДЕНЕГ!' };

export function buyRecipe(s: GameState, index: number): ActionResult {
  if (s.pizzaPrice[index] > 0) return { ok: false };
  const price = recipePrice(index);
  if (s.money < price) return NO_MONEY;
  s.money -= price;
  s.assets += Math.floor(price / 2);
  s.pizzaPrice[index] = PIZZAS[index].cost;
  log(s, `КУПЛЕН РЕЦЕПТ ${PIZZAS[index].name}`);
  return { ok: true };
}

export function supplyIngredient(s: GameState, index: number): ActionResult {
  if (s.ingredientSupplied[index]) return { ok: false };
  const price = 100 * INGREDIENTS[index].cost;
  if (s.money < price) return NO_MONEY;
  s.money -= price;
  s.assets += Math.floor(price / 2);
  s.ingredientSupplied[index] = true;
  log(s, `ПОСТАВКА: ${INGREDIENTS[index].name}`);
  return { ok: true };
}

export function supplyProduct(s: GameState, index: number): ActionResult {
  if (s.productPrice[index] > 0) return { ok: false };
  const price = 100 * PRODUCTS[index].cost;
  if (s.money < price) return NO_MONEY;
  s.money -= price;
  s.assets += Math.floor(price / 2);
  s.productPrice[index] = PRODUCTS[index].cost;
  log(s, `ПОСТАВКА: ${PRODUCTS[index].name}`);
  return { ok: true };
}

export function startAd(s: GameState, index: number): ActionResult {
  if (s.ads[index]) return { ok: false };
  const cost = ADS[index].dayCost;
  if (s.money < cost) return NO_MONEY;
  s.ads[index] = true;
  s.assets += 2 * cost;
  log(s, `РЕКЛАМА: ${ADS[index].name}`);
  return { ok: true };
}

export function stopAd(s: GameState, index: number): ActionResult {
  if (!s.ads[index]) return { ok: false };
  const cost = ADS[index].dayCost;
  s.ads[index] = false;
  s.assets -= 2 * cost;
  // Stopping still costs one final day (C.java:2895).
  s.money -= cost;
  return { ok: true };
}

export function installUpgrade(s: GameState, index: number): ActionResult {
  if (s.upgrades[index]) return { ok: false };
  const cost = UPGRADES[index].cost;
  if (s.money < cost) return NO_MONEY;
  s.money -= cost;
  // The second floor is booked at full value, everything else at half.
  s.assets += index === UPGRADE_SECOND_FLOOR ? cost : Math.floor(cost / 2);
  s.upgrades[index] = true;
  log(s, `УСТАНОВЛЕНО: ${UPGRADES[index].name}`);
  return { ok: true };
}

export function buyMachine(s: GameState, index: number): ActionResult {
  if (s.machines[index]) return { ok: false };
  const cost = MACHINES[index].cost;
  if (s.money < cost) return NO_MONEY;
  s.money -= cost;
  s.assets += Math.floor(cost / 2);
  s.machines[index] = true;
  log(s, `АВТОМАТ: ${MACHINES[index].name}`);
  return { ok: true };
}

export function sellMachine(s: GameState, index: number): ActionResult {
  if (!s.machines[index]) return { ok: false };
  const half = Math.floor(MACHINES[index].cost / 2);
  s.machines[index] = false;
  s.money += half;
  s.assets -= half;
  return { ok: true };
}

export function hire(s: GameState, slot: number): ActionResult {
  const c = s.candidates.find((x) => x.slot === slot);
  if (!c || c.hired) return { ok: false };
  if (hiredOf(s, c.type).length >= hireCap(s)) {
    return { ok: false, message: 'ВЫ НЕ МОЖЕТЕ БОЛЬШЕ НАНЯТЬ ЭТИХ СОТРУДНИКОВ!' };
  }
  c.hired = true;
  log(s, `НАНЯТ: ${STAFF_NAMES[c.slot]}`);
  return { ok: true };
}

export function fire(s: GameState, slot: number): ActionResult {
  const c = s.candidates.find((x) => x.slot === slot);
  if (!c || !c.hired) return { ok: false };
  const severance = 7 * wageOf(c);
  if (s.money < severance) {
    return {
      ok: false,
      message: 'ВЫ НЕ МОЖЕТЕ УВОЛИТЬ ЭТОГО РАБОТНИКА, Т.К. У ВАС НЕ ХВАТИТ ДЕНЕГ ДЛЯ ВЫПЛАТЫ ЕГО НЕДЕЛЬНОГО ЖАЛОВАНИЯ!',
    };
  }
  s.money -= severance;
  c.hired = false;
  log(s, `УВОЛЕН: ${STAFF_NAMES[c.slot]}`);
  return { ok: true };
}

/** Buys (`delta > 0`) or writes off (`delta < 0`) warehouse stock. */
export function tradeIngredient(s: GameState, index: number, delta: number): void {
  const unit = INGREDIENTS[index].cost;
  applyTrade(s, delta, unit, (n) => {
    s.ingredientStock[index] = Math.max(0, Math.min(32000, s.ingredientStock[index] + n));
  }, s.ingredientStock[index]);
}

export function tradeProduct(s: GameState, index: number, delta: number): void {
  const unit = PRODUCTS[index].cost;
  applyTrade(s, delta, unit, (n) => {
    s.productStock[index] = Math.max(0, Math.min(32000, s.productStock[index] + n));
  }, s.productStock[index]);
}

function applyTrade(
  s: GameState,
  delta: number,
  unit: number,
  commit: (n: number) => void,
  current: number,
): void {
  if (delta > 0) {
    const affordable = Math.min(delta, Math.floor(s.money / unit), 32000 - current);
    if (affordable <= 0) return;
    s.money -= affordable * unit;
    commit(affordable);
  } else if (delta < 0) {
    const sellable = Math.min(-delta, current);
    if (sellable <= 0) return;
    // Written off at half price, exactly like the original.
    s.money += Math.floor((sellable * unit) / 2);
    commit(-sellable);
  }
}

/** Nudges a selling price; the floor is the cost price, the ceiling is 32000. */
export function adjustPizzaPrice(s: GameState, index: number, delta: number): void {
  if (s.pizzaPrice[index] === 0) return;
  const floor = PIZZAS[index].cost;
  s.pizzaPrice[index] = Math.max(floor, Math.min(32000, s.pizzaPrice[index] + delta));
}

export function adjustProductPrice(s: GameState, index: number, delta: number): void {
  if (s.productPrice[index] === 0) return;
  const floor = PRODUCTS[index].cost;
  s.productPrice[index] = Math.max(floor, Math.min(32000, s.productPrice[index] + delta));
}

export function log(s: GameState, text: string): void {
  s.ticker.push(text);
  if (s.ticker.length > 6) s.ticker.shift();
}
