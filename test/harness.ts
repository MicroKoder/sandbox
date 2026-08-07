import {
  ADS,
  INGREDIENTS,
  MACHINES,
  PIZZAS,
  PRODUCTS,
  UPGRADES,
  UPGRADE_SECOND_FLOOR,
  UPGRADE_TABLES,
} from '../src/data/content.ts';
import { MISSIONS } from '../src/data/missions.ts';
import { Rng } from '../src/game/rng.ts';
import { createContext, tick, type SimContext } from '../src/game/sim.ts';
import {
  OFFERED_MACHINES,
  adjustPizzaPrice,
  adjustProductPrice,
  buyMachine,
  buyRecipe,
  createGame,
  dailyAdCost,
  dailySalary,
  hire,
  hireCap,
  hiredOf,
  installUpgrade,
  marketOf,
  ownedRecipes,
  startAd,
  supplyIngredient,
  supplyProduct,
  tradeIngredient,
  tradeProduct,
  type GameState,
} from '../src/game/state.ts';

export interface HarnessOptions {
  mission?: number;
  difficulty?: 0 | 1 | 2;
  seed?: number;
  /** Selling price as a multiple of the cost price. */
  markup?: number;
}

/** Units of each ingredient / product the bot tries to hold at all times. */
const INGREDIENT_TARGET = 5000;
const PRODUCT_TARGET = 1200;

/**
 * A scripted "competent player". Used to check that the missions are winnable
 * and that no system is inert; it is not meant to be an optimal strategy.
 *
 * Spending priority, highest first:
 *   1. tables (without them nobody comes in at all)
 *   2. one recipe plus its ingredient supplies
 *   3. a cook and a waiter
 *   4. every product the mission offers, kept in stock
 *   5. vending machines (one visitor in five wants one)
 *   6. the second floor, then a second cook and waiter
 *   7. spare cash goes into more recipes and deeper stock
 */
export function bootstrap(opts: HarnessOptions = {}): SimContext {
  const rng = new Rng(opts.seed ?? 12345);
  const state = createGame(
    {
      playerName: 'ТЕСТ',
      difficulty: opts.difficulty ?? 1,
      campaign: false,
      missionIndex: opts.mission ?? 0,
    },
    rng,
  );
  const ctx = createContext(state, rng);
  const markup = opts.markup ?? 1.8;

  installUpgrade(state, UPGRADE_TABLES);
  buyCheapestRecipe(state, markup);
  hireBest(state, 0);
  hireBest(state, 1);
  manage(state, markup);
  return ctx;
}

export function buyCheapestRecipe(s: GameState, markup: number): boolean {
  const options = MISSIONS[s.missionIndex].recipes
    .filter((r) => s.pizzaPrice[r] === 0)
    .sort((a, b) => PIZZAS[a].cost - PIZZAS[b].cost);
  for (const r of options) {
    if (buyRecipe(s, r).ok) {
      adjustPizzaPrice(s, r, Math.round(PIZZAS[r].cost * (markup - 1)));
      return true;
    }
  }
  return false;
}

export function hireBest(s: GameState, type: number): boolean {
  if (hiredOf(s, type).length >= hireCap(s)) return false;
  const best = [...marketOf(s, type)].sort((a, b) => b.skill + b.speed - (a.skill + a.speed))[0];
  return best ? hire(s, best.slot).ok : false;
}

/** Cash that must stay in the bank: several days of fixed costs. */
function reserveOf(s: GameState): number {
  return Math.max(6000, 3 * (dailySalary(s) + dailyAdCost(s)));
}

const spare = (s: GameState): number => Math.max(0, s.money - reserveOf(s));

/**
 * Buys ingredients in whole-pizza batches so that no single expensive line eats
 * the budget and leaves a recipe unbakeable.
 */
function stockIngredients(s: GameState, target: number): void {
  const recipes = ownedRecipes(s);
  const needed = new Set<number>();
  for (const r of recipes) for (const ing of PIZZAS[r].ingredients) needed.add(ing);

  for (const ing of needed) {
    if (!s.ingredientSupplied[ing] && spare(s) > 100 * INGREDIENTS[ing].cost) supplyIngredient(s, ing);
  }

  // Fill whichever line is emptiest, one batch at a time, re-checking the bank
  // after every purchase so a run of expensive items cannot overdraw it.
  const live = [...needed].filter((ing) => s.ingredientSupplied[ing]);
  const step = 200;
  for (let guard = 0; guard < 600; guard++) {
    const lowest = live
      .filter((ing) => s.ingredientStock[ing] < target)
      .sort((a, b) => s.ingredientStock[a] - s.ingredientStock[b])[0];
    if (lowest === undefined) return;
    if (spare(s) < INGREDIENTS[lowest].cost * step) return;
    tradeIngredient(s, lowest, step);
  }
}

/**
 * Products are stocked evenly: a visitor who draws any sold-out line leaves with
 * "малый выбор", so breadth beats depth.
 */
function stockProducts(s: GameState, markup: number, target: number): void {
  const products = [...MISSIONS[s.missionIndex].products].sort(
    (a, b) => PRODUCTS[a].cost - PRODUCTS[b].cost,
  );

  for (const prod of products) {
    if (s.productPrice[prod] > 0) continue;
    if (spare(s) <= 100 * PRODUCTS[prod].cost) continue;
    if (supplyProduct(s, prod).ok) {
      adjustProductPrice(s, prod, Math.round(PRODUCTS[prod].cost * (markup - 1)));
    }
  }

  const live = products.filter((p) => s.productPrice[p] > 0);
  if (live.length === 0) return;

  // Top up whichever line is emptiest, one small batch at a time, until either
  // everything is at target or the money runs out.
  const step = 100;
  for (let guard = 0; guard < 400; guard++) {
    const lowest = live
      .filter((p) => s.productStock[p] < target)
      .sort((a, b) => s.productStock[a] - s.productStock[b])[0];
    if (lowest === undefined) return;
    if (spare(s) < PRODUCTS[lowest].cost * step) return;
    tradeProduct(s, lowest, step);
  }
}

/** Establishes every supply line the mission offers, cheapest first. */
function supplyEverything(s: GameState, markup: number): void {
  const needed = new Set<number>();
  for (const r of ownedRecipes(s)) for (const ing of PIZZAS[r].ingredients) needed.add(ing);
  for (const ing of [...needed].sort((a, b) => INGREDIENTS[a].cost - INGREDIENTS[b].cost)) {
    if (!s.ingredientSupplied[ing] && spare(s) > 100 * INGREDIENTS[ing].cost) supplyIngredient(s, ing);
  }
  const products = [...MISSIONS[s.missionIndex].products].sort((a, b) => PRODUCTS[a].cost - PRODUCTS[b].cost);
  for (const prod of products) {
    if (s.productPrice[prod] > 0) continue;
    if (spare(s) <= 100 * PRODUCTS[prod].cost) continue;
    if (supplyProduct(s, prod).ok) {
      adjustProductPrice(s, prod, Math.round(PRODUCTS[prod].cost * (markup - 1)));
    }
  }
}

/** The morning routine. */
export function manage(s: GameState, markup: number): void {
  const mission = MISSIONS[s.missionIndex];
  // Close to the deadline, stop reinvesting and let the till fill up.
  if (mission.goalType === 0 && s.day >= mission.days - 2 && s.money < mission.goalMoney) {
    stockIngredients(s, 1200);
    stockProducts(s, markup, 250);
    return;
  }
  if (!s.upgrades[UPGRADE_TABLES] && spare(s) > UPGRADES[UPGRADE_TABLES].cost) {
    installUpgrade(s, UPGRADE_TABLES);
  }
  if (ownedRecipes(s).length === 0) buyCheapestRecipe(s, markup);

  hireBest(s, 0);
  hireBest(s, 1);

  // Breadth first: an unsupplied product line costs rating on every draw.
  supplyEverything(s, markup);
  // Flour first (no pizza, no business), then a day of every product line, then
  // deepen both while the money lasts.
  stockIngredients(s, 1500);
  stockProducts(s, markup, 300);
  stockIngredients(s, INGREDIENT_TARGET);
  stockProducts(s, markup, PRODUCT_TARGET);

  // Alcohol on the menu means the room needs somebody on the door.
  if (MISSIONS[s.missionIndex].products.some((p) => PRODUCTS[p].alcohol && s.productPrice[p] > 0)) {
    hireBest(s, 4);
  }

  for (const m of OFFERED_MACHINES) {
    if (!s.machines[m] && spare(s) > MACHINES[m].cost * 2) buyMachine(s, m);
  }

  if (!s.upgrades[UPGRADE_SECOND_FLOOR] && spare(s) > UPGRADES[UPGRADE_SECOND_FLOOR].cost * 2) {
    installUpgrade(s, UPGRADE_SECOND_FLOOR);
  }
  hireBest(s, 1);
  hireBest(s, 0);
  hireBest(s, 2);
  hireBest(s, 3);

  // Advertising is the main engine behind the prestige multiplier: each running
  // campaign adds twice its daily rate to the asset value.
  for (const ad of [...MISSIONS[s.missionIndex].ads].sort((a, b) => ADS[a].dayCost - ADS[b].dayCost)) {
    if (s.ads[ad]) continue;
    if (spare(s) < ADS[ad].dayCost * 12) break;
    startAd(s, ad);
  }

  // Only widen the menu once the basics are covered and cash is comfortable.
  while (spare(s) > 120000 && buyCheapestRecipe(s, markup)) {
    stockIngredients(s, INGREDIENT_TARGET);
  }
}

/** Runs `days` game days, calling `manage` every morning. */
export function run(ctx: SimContext, days: number, markup = 1.8): void {
  const s = ctx.state;
  for (let d = 0; d < days; d++) {
    const startDay = s.day;
    let guard = 0;
    while (s.day === startDay && !s.ending && guard++ < 40000) {
      tick(ctx);
      // An attentive player tops the warehouse up during the day, too.
      if (s.tick % 1200 === 0) manage(s, markup);
    }
    if (s.ending) break;
    manage(s, markup);
  }
}
