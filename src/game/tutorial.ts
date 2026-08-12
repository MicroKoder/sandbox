import { PIZZAS, PRODUCTS } from '../data/content.ts';
import {
  bakeableCount,
  hasTables,
  hiredOf,
  missionOf,
  ownedRecipes,
  suppliedProducts,
  unsuppliedIngredients,
  type GameState,
} from './state.ts';

/**
 * First-mission coach ("Пицца Мэн"). One tip at a time; the next tip appears
 * only after the current goal is met.
 */

export interface TutorialStep {
  /** Speech-bubble copy. */
  text: (s: GameState) => string;
  /** Tab strip index to pulse, or −1. */
  tab: number;
  /** Preferred sub-tab when the player opens the highlighted tab. */
  sub: number;
  done: (s: GameState, ctx: TutorialContext) => boolean;
}

export interface TutorialContext {
  /** True while the statistics tab is open. */
  statsOpen?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    tab: 8,
    sub: 1,
    text: () =>
      'ПРИВЕТ! Я ПИЦЦА МЭН.\nСНАЧАЛА КУПИ СТОЛЫ В «МОДЕРНИЗАЦИЯ» — БЕЗ НИХ ГОСТИ НЕ ЗАЙДУТ!',
    done: (s) => hasTables(s),
  },
  {
    tab: 2,
    sub: 1,
    text: () => 'ОТЛИЧНО! ТЕПЕРЬ КУПИ ХОТЯ БЫ ОДИН РЕЦЕПТ ПИЦЦЫ ВО ВКЛАДКЕ «РЕЦЕПТЫ».',
    done: (s) => ownedRecipes(s).length > 0,
  },
  {
    tab: 3,
    sub: 1,
    text: () =>
      'НАЛАДЬ ПОСТАВКИ ВСЕХ ИНГРЕДИЕНТОВ ДЛЯ ТВОИХ РЕЦЕПТОВ — «ИНГРЕДИЕНТЫ» → «ПОСТАВКИ».',
    done: (s) => ownedRecipes(s).length > 0 && unsuppliedIngredients(s).length === 0,
  },
  {
    tab: 4,
    sub: 1,
    text: () =>
      'ДОБАВЬ НАПИТКИ И ЗАКУСКИ: НАЛАДЬ ХОТЯ БЫ ОДНУ ПОСТАВКУ ВО ВКЛАДКЕ «ПРОДУКТЫ».',
    done: (s) => suppliedProducts(s).length > 0,
  },
  {
    tab: 10,
    sub: 1,
    text: () =>
      'НАЙМИ ПОВАРА И ОФИЦИАНТА ВО ВКЛАДКЕ «СОТРУДНИКИ» — БЕЗ НИХ ЗАЛ НЕ РАБОТАЕТ!',
    done: (s) => hiredOf(s, 0).length > 0 && hiredOf(s, 1).length > 0,
  },
  {
    tab: 1,
    sub: 0,
    text: () =>
      'ПОДНИМИ ЦЕНЫ ВЫШЕ СЕБЕСТОИМОСТИ В «ЦЕНЫ В МЕНЮ» — ИНАЧЕ ТОРГОВАТЬ НЕВЫГОДНО!',
    done: (s) => !menuAtCost(s),
  },
  {
    tab: 3,
    sub: 0,
    text: () =>
      'ЗАКУПИ СКЛАД: КУПИ ИНГРЕДИЕНТЫ ВО ВКЛАДКЕ «ИНГРЕДИЕНТЫ» → «СКЛАД», ЧТОБЫ ПЕЧЬ ПИЦЦУ.',
    done: (s) => ownedRecipes(s).some((r) => bakeableCount(s, r) > 0),
  },
  {
    tab: 4,
    sub: 0,
    text: () =>
      'КУПЕРЬ КУПИ НАПИТКИ И ЗАКУСКИ ВО ВКЛАДКЕ «ПРОДУКТЫ» → «СКЛАД».',
    done: (s) => suppliedProducts(s).some((i) => s.productStock[i] > 0),
  },
  {
    tab: 6,
    sub: 1,
    text: (s) => {
      const m = missionOf(s);
      if (m.goalType === 1) {
        return `ЗАГЛЯНИ В «СТАТИСТИКА» → «ЗАДАЧА». НУЖНО ПРОДЕРЖАТЬ РЕЙТИНГ ${formatGoalRating(m.goalRating)} ${m.days} ДН.`;
      }
      return `ЗАГЛЯНИ В «СТАТИСТИКА» → «ЗАДАЧА». ЦЕЛЬ: ${formatGoalMoney(m.goalMoney)}$ И РЕЙТИНГ ${formatGoalRating(m.goalRating)}.`;
    },
    done: (_s, ctx) => Boolean(ctx.statsOpen),
  },
];

function formatGoalMoney(v: number): string {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatGoalRating(v: number): string {
  return `${(v / 1000).toFixed(1)}%`;
}

/** True when any owned pizza or supplied product still sells at cost. */
export function menuAtCost(s: GameState): boolean {
  const pizzaCost = ownedRecipes(s).some((i) => s.pizzaPrice[i] <= PIZZAS[i].cost);
  const productCost = PRODUCTS.some((p, i) => s.productPrice[i] > 0 && s.productPrice[i] <= p.cost);
  return pizzaCost || productCost;
}

/** Active tip index, or −1 when the coach is done / not used. */
export function tutorialStepOf(s: GameState): number {
  if (s.missionIndex !== 0) return -1;
  if (typeof s.tutorialStep !== 'number') {
    // Older saves: pick up wherever the player already is.
    let step = 0;
    while (step < TUTORIAL_STEPS.length && TUTORIAL_STEPS[step].done(s, {})) step++;
    s.tutorialStep = step >= TUTORIAL_STEPS.length ? -1 : step;
  }
  return s.tutorialStep;
}

/** Advance through any completed tips; call each frame from the play screen. */
export function advanceTutorial(s: GameState, ctx: TutorialContext = {}): void {
  if (s.missionIndex !== 0) {
    s.tutorialStep = -1;
    return;
  }
  let step = tutorialStepOf(s);
  if (step < 0) return;
  while (step >= 0 && step < TUTORIAL_STEPS.length && TUTORIAL_STEPS[step].done(s, ctx)) {
    step++;
  }
  s.tutorialStep = step >= TUTORIAL_STEPS.length ? -1 : step;
}

export function tutorialHighlightTab(s: GameState): number {
  const step = tutorialStepOf(s);
  if (step < 0) return -1;
  return TUTORIAL_STEPS[step]?.tab ?? -1;
}

export function tutorialPreferredSub(s: GameState): number {
  const step = tutorialStepOf(s);
  if (step < 0) return 0;
  return TUTORIAL_STEPS[step]?.sub ?? 0;
}

export function tutorialText(s: GameState): string | null {
  const step = tutorialStepOf(s);
  if (step < 0) return null;
  return TUTORIAL_STEPS[step]?.text(s) ?? null;
}

/** Whether mission 0 still has an active coach tip. */
export function tutorialActive(s: GameState): boolean {
  return tutorialStepOf(s) >= 0;
}
