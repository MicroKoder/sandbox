import type { App, Screen } from '../app/app.ts';
import { getTabIcons, pizzaSprite, getProductIcons, getMachineIcons, TAB_ICON_H, TAB_ICON_W } from '../art/icons.ts';
import { C } from '../core/palette.ts';
import type { Painter, Rect } from '../core/painter.ts';
import { BOTTOM_BAR_H, SCREEN_H, SCREEN_W, TAB_STRIP_W, TOP_BAR_H } from '../core/screen.ts';
import {
  ADS,
  INGREDIENTS,
  MACHINES,
  PIZZAS,
  PRODUCTS,
  STAFF_KINDS,
  STAFF_NAMES,
  UPGRADES,
  recipePrice,
} from '../data/content.ts';
import { CONFIRM, EMPTY, HELP_BOOK, S, helpPageForTab } from '../data/strings.ts';
import {
  SPEED_TICKS,
  adjustPizzaPrice,
  adjustProductPrice,
  bakeableCount,
  buyMachine,
  buyRecipe,
  buyableRecipes,
  clockOf,
  dailyAdCost,
  dailySalary,
  fire,
  hire,
  hireCap,
  hiredOf,
  idleAds,
  installUpgrade,
  installedMachines,
  installedUpgrades,
  marketOf,
  missionOf,
  ownedRecipes,
  pendingMachines,
  pendingUpgrades,
  runningAds,
  scaleOf,
  sellMachine,
  startAd,
  stopAd,
  log,
  suppliedIngredients,
  suppliedProducts,
  supplyIngredient,
  supplyProduct,
  tradeIngredient,
  tradeProduct,
  unsuppliedIngredients,
  unsuppliedProducts,
  wageOf,
  type GameState,
  type Speed,
} from '../game/state.ts';
import { tick, warnings } from '../game/sim.ts';
import type { Key } from '../ui/input.ts';
import {
  adjustButtons,
  dialog,
  fieldLine,
  formatMoney,
  formatRating,
  listWindow,
  notice,
  row,
  scrollbar,
  softkeys,
  subTabs,
  type AdjustButtonHit,
} from '../ui/widgets.ts';
import { ConfirmScreen, EndingScreen, HelpScreen, MenuScreen, saveSession } from './menu.ts';
import { drawExterior, drawInterior } from './pizzeria.ts';

const TAB_COUNT = 11;
/** The pizzeria view — the only screen on which the clock advances. */
const TAB_PIZZERIA = 0;
const TAB_H = 16;
const TAB_TOP = TOP_BAR_H + 1;

const TAB_TITLES = [
  S.tabPizzeria,
  S.tabPrices,
  S.tabRecipes,
  S.tabIngredients,
  S.tabProducts,
  S.tabAds,
  S.tabStats,
  S.tabMap,
  S.tabUpgrades,
  S.tabMachines,
  S.tabStaff,
];

const SUB_TABS: Array<string[]> = [
  [S.subOutside, S.subInside],
  [S.subPizzaPrices, S.subProductPrices],
  [S.subOwned, S.subAcquire],
  [S.subStock, S.subSupply],
  [S.subStock, S.subSupply],
  [S.subRunning, S.subAvailable],
  [S.subStats, S.subTask],
  [],
  [S.subOwned, S.subInstall],
  [S.subOwned, S.subAcquire],
  [S.subStaff, S.subHire],
];

const CONTENT: Rect = {
  x: 0,
  y: TOP_BAR_H,
  w: SCREEN_W - TAB_STRIP_W,
  h: SCREEN_H - TOP_BAR_H - BOTTOM_BAR_H,
};

/** Area under the sub-tab strip that the list widgets get to use. */
const LIST_AREA: Rect = { x: CONTENT.x, y: CONTENT.y + 11, w: CONTENT.w, h: CONTENT.h - 11 };

interface ListRow {
  /** Index into the underlying content array. */
  id: number;
  label: string;
  right?: string;
  rightColor?: string;
  sub?: string;
  icon?: HTMLCanvasElement;
  dim?: boolean;
}

export class PlayScreen implements Screen {
  private tab = 0;
  private sub = 0;
  /** Employee category shown by the staff tab. */
  private staffKind = 0;
  private cursor: number[] = new Array(TAB_COUNT).fill(0);
  private first: number[] = new Array(TAB_COUNT).fill(0);
  private tabFocus = false;
  private message: string | null = null;
  private messageTimer = 0;
  private accumulator = 0;
  /** Hit boxes for the ±quantity / ±price buttons drawn in the detail pane. */
  private adjustHits: AdjustButtonHit[] = [];
  /** Pixel remainder while dragging/wheeling the list. */
  private scrollCarry = 0;

  enter(app: App): void {
    if (!app.session) app.reset(new MenuScreen());
  }

  // ------------------------------------------------------------------ loop

  update(app: App, dt: number): void {
    const session = app.session;
    if (!session) return;
    const s = session.state;

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = null;
    }

    if (s.ending) {
      app.replace(new EndingScreen(s));
      return;
    }

    if (!this.timeRunning(s)) {
      this.accumulator = 0;
      return;
    }

    // Fixed 60 Hz simulation step so speeds behave the same on any display.
    this.accumulator += Math.min(dt, 100);
    const stepMs = 1000 / 60;
    while (this.accumulator >= stepMs) {
      this.accumulator -= stepMs;
      const ticks = SPEED_TICKS[s.speed];
      for (let i = 0; i < ticks; i++) {
        tick(session);
        if (s.ending) break;
      }
      if (s.ending) break;
    }
  }

  /**
   * The original only advanced the clock from the pizzeria screen — the tick loop
   * was reached from that one branch of the screen dispatcher, so every menu
   * froze the simulation. Keeping that means shopping, hiring and re-pricing cost
   * no game time, which is what makes the short missions manageable.
   */
  private timeRunning(s: GameState): boolean {
    return this.tab === TAB_PIZZERIA && s.speed > 0;
  }

  // ------------------------------------------------------------------ draw

  draw(app: App, p: Painter): void {
    const session = app.session;
    if (!session) return;
    const s = session.state;

    p.clear(C.bg);
    this.drawTopBar(p, s);

    p.pushClip(CONTENT);
    this.drawTab(app, p, s);
    p.popClip();

    // While the clock is stopped because the player is off in a menu, nudge them
    // back to the pizzeria tab with a slow blink.
    const nudge = s.speed > 0 && this.tab !== TAB_PIZZERIA && Math.floor(app.clock / 500) % 2 === 0;
    this.drawTabStrip(p, s, nudge);
    this.drawSoftkeys(p, s);

    if (this.message) dialog(p, this.message);
  }

  private drawTopBar(p: Painter, s: GameState): void {
    p.gradientV(0, 0, SCREEN_W, TOP_BAR_H, C.panelHi, C.panel);
    p.hLine(0, TOP_BAR_H - 1, SCREEN_W, C.line);

    const running = this.timeRunning(s);
    p.text(clockOf(s), 3, 3, running ? C.ink : C.inkDim);

    // Speed: three pips while the clock runs, a pause bar while it is stopped.
    if (!running) {
      p.fill(29, 4, 2, 5, C.tomato);
      p.fill(33, 4, 2, 5, C.tomato);
    } else {
      for (let i = 0; i < 3; i++) {
        p.fill(29 + i * 4, 4, 3, 5, s.speed > i ? C.gold : C.panelLo);
      }
    }
    p.vLine(42, 2, 8, C.lineSoft);

    p.text(`Д${s.day + 1}/${missionOf(s).days}`, 46, 3, C.inkDim);
    p.vLine(70, 2, 8, C.lineSoft);
    p.text(formatRating(s.rating), 74, 3, C.sky);

    // Amber once the till no longer covers tonight's wages and advertising bill.
    const due = dailySalary(s) + dailyAdCost(s);
    const shortOfBills = due > 0 && s.money < due;
    p.text(
      `${formatMoney(s.money)}$`,
      SCREEN_W - 3,
      3,
      s.money < 0 ? C.tomato : shortOfBills ? C.warn : C.money,
      'right',
    );
    if (shortOfBills) p.text('!', SCREEN_W - 3 - p.measure(`${formatMoney(s.money)}$`) - 5, 3, C.tomato);
  }

  private drawTabStrip(p: Painter, s: GameState, nudge: boolean): void {
    const x = SCREEN_W - TAB_STRIP_W;
    p.fill(x, TOP_BAR_H, TAB_STRIP_W, SCREEN_H - TOP_BAR_H - BOTTOM_BAR_H, C.bar);
    p.vLine(x, TOP_BAR_H, SCREEN_H - TOP_BAR_H - BOTTOM_BAR_H, C.line);

    const icons = getTabIcons();
    const warn = warnings(s);

    for (let i = 0; i < TAB_COUNT; i++) {
      const y = TAB_TOP + i * TAB_H;
      const active = i === this.tab;
      if (active) {
        p.gradientV(x + 1, y, TAB_STRIP_W - 1, TAB_H - 1, C.selBgAlt, C.selBg);
        p.hLine(x + 1, y, TAB_STRIP_W - 1, C.gold);
      } else if (warn[i]) {
        p.fill(x + 1, y, TAB_STRIP_W - 1, TAB_H - 1, '#5a2118');
      }
      if (this.tabFocus && active) p.stroke(x, y - 1, TAB_STRIP_W, TAB_H, C.gold);
      if (nudge && i === TAB_PIZZERIA) p.stroke(x, y - 1, TAB_STRIP_W, TAB_H, C.gold);

      const icon = icons[i];
      if (icon) {
        p.blit(icon, x + 2 + (TAB_STRIP_W - 2 - TAB_ICON_W) / 2, y + (TAB_H - 1 - TAB_ICON_H) / 2);
      }
      if (warn[i] && !active) p.fill(x + TAB_STRIP_W - 4, y + 2, 2, 2, C.tomato);
    }
  }

  private drawSoftkeys(p: Painter, s: GameState): void {
    softkeys(p, 'МЕНЮ', this.actionLabel(s), TAB_TITLES[this.tab]);
  }

  // ------------------------------------------------------------- tab bodies

  private drawTab(app: App, p: Painter, s: GameState): void {
    const subs = SUB_TABS[this.tab];
    if (subs.length === 0) {
      // Screens without sub-views still get a header so the layout stays stable.
      subTabs(p, CONTENT.x, CONTENT.y, CONTENT.w, [TAB_TITLES[this.tab]], 0, false);
    } else if (this.tab === 10) {
      // The staff screen cycles through five professions x two sub-screens, so a
      // single combined pill reads better than two competing tab rows.
      subTabs(p, CONTENT.x, CONTENT.y, CONTENT.w, [`${STAFF_KINDS[this.staffKind]} · ${subs[this.sub]}`], 0);
    } else if (subs.length > 1) {
      subTabs(p, CONTENT.x, CONTENT.y, CONTENT.w, subs, this.sub);
    }

    switch (this.tab) {
      case 0:
        this.drawPizzeria(app, p, s);
        break;
      case 6:
        if (this.sub === 0) this.drawStats(p, s);
        else this.drawTask(p, s);
        break;
      case 7:
        this.drawMap(p, s);
        break;
      default:
        this.drawList(p, s);
        break;
    }
  }

  private drawPizzeria(app: App, p: Painter, s: GameState): void {
    const session = app.session;
    if (!session) return;
    const oy = CONTENT.y + 11;
    p.pushClip({ x: CONTENT.x, y: oy, w: CONTENT.w, h: CONTENT.h - 11 });
    if (this.sub === 0) drawExterior(p, s, session.world, oy, app.clock);
    else drawInterior(p, s, session.world, oy);
    p.popClip();

    // Event ticker along the bottom of the view.
    const last = s.ticker[s.ticker.length - 1];
    if (last) {
      p.setAlpha(0.7);
      p.fill(CONTENT.x, CONTENT.y + CONTENT.h - 9, CONTENT.w, 9, '#000');
      p.setAlpha(1);
      p.text(last, CONTENT.x + 3, CONTENT.y + CONTENT.h - 8, C.gold);
    }
  }

  // ---------------------------------------------------------------- lists

  private rows(s: GameState): ListRow[] {
    switch (this.tab) {
      case 1:
        return this.sub === 0
          ? ownedRecipes(s).map((i) => ({
              id: i,
              label: PIZZAS[i].name,
              right: `${s.pizzaPrice[i]}$`,
              rightColor: s.pizzaPrice[i] <= PIZZAS[i].cost ? C.tomato : C.gold,
              sub: `${S.costPrice} ${PIZZAS[i].cost}$`,
              icon: pizzaThumb(i),
            }))
          : suppliedProducts(s).map((i) => ({
              id: i,
              label: PRODUCTS[i].name,
              right: `${s.productPrice[i]}$`,
              rightColor: s.productPrice[i] <= PRODUCTS[i].cost ? C.tomato : C.gold,
              sub: `${S.costPrice} ${PRODUCTS[i].cost}$`,
              icon: getProductIcons()[i],
            }));

      case 2:
        return this.sub === 0
          ? ownedRecipes(s).map((i) => ({
              id: i,
              label: PIZZAS[i].name,
              right: `${bakeableCount(s, i)}`,
              sub: `${S.costPrice} ${PIZZAS[i].cost}$ · НА СКЛАДЕ ${s.pizzaStock[i]}`,
              icon: pizzaThumb(i),
            }))
          : buyableRecipes(s).map((i) => ({
              id: i,
              label: PIZZAS[i].name,
              right: `${formatMoney(recipePrice(i))}$`,
              rightColor: s.money >= recipePrice(i) ? C.gold : C.tomato,
              sub: PIZZAS[i].ingredients.map((ing) => INGREDIENTS[ing].name).join(', '),
              icon: pizzaThumb(i),
            }));

      case 3:
        return this.sub === 0
          ? suppliedIngredients(s).map((i) => ({
              id: i,
              label: INGREDIENTS[i].name,
              right: `${s.ingredientStock[i]}`,
              rightColor: s.ingredientStock[i] > 0 ? C.gold : C.tomato,
              sub: `${S.unitPrice} ${INGREDIENTS[i].cost}$`,
            }))
          : unsuppliedIngredients(s).map((i) => ({
              id: i,
              label: INGREDIENTS[i].name,
              right: `${formatMoney(100 * INGREDIENTS[i].cost)}$`,
              rightColor: s.money >= 100 * INGREDIENTS[i].cost ? C.gold : C.tomato,
              sub: INGREDIENTS[i].desc,
            }));

      case 4:
        return this.sub === 0
          ? suppliedProducts(s).map((i) => ({
              id: i,
              label: PRODUCTS[i].name,
              right: `${s.productStock[i]}`,
              rightColor: s.productStock[i] > 0 ? C.gold : C.tomato,
              sub: `${S.unitPrice} ${PRODUCTS[i].cost}$`,
              icon: getProductIcons()[i],
            }))
          : unsuppliedProducts(s).map((i) => ({
              id: i,
              label: PRODUCTS[i].name,
              right: `${formatMoney(100 * PRODUCTS[i].cost)}$`,
              rightColor: s.money >= 100 * PRODUCTS[i].cost ? C.gold : C.tomato,
              sub: PRODUCTS[i].desc,
              icon: getProductIcons()[i],
            }));

      case 5:
        return (this.sub === 0 ? runningAds(s) : idleAds(s)).map((i) => ({
          id: i,
          label: ADS[i].name,
          right: `${formatMoney(ADS[i].dayCost)}$`,
          rightColor: this.sub === 0 ? C.basil : s.money >= ADS[i].dayCost ? C.gold : C.tomato,
          sub: ADS[i].desc,
        }));

      case 8:
        return (this.sub === 0 ? installedUpgrades(s) : pendingUpgrades(s)).map((i) => ({
          id: i,
          label: UPGRADES[i].name,
          right: `${formatMoney(UPGRADES[i].cost)}$`,
          rightColor: this.sub === 0 ? C.basil : s.money >= UPGRADES[i].cost ? C.gold : C.tomato,
          sub: UPGRADES[i].desc,
        }));

      case 9:
        return (this.sub === 0 ? installedMachines(s) : pendingMachines(s)).map((i) => ({
          id: i,
          label: MACHINES[i].name,
          right: `${formatMoney(this.sub === 0 ? Math.floor(MACHINES[i].cost / 2) : MACHINES[i].cost)}$`,
          rightColor: this.sub === 0 ? C.basil : s.money >= MACHINES[i].cost ? C.gold : C.tomato,
          sub: MACHINES[i].desc,
          icon: getMachineIcons()[i],
        }));

      case 10: {
        const list = this.sub === 0 ? hiredOf(s, this.staffKind) : marketOf(s, this.staffKind);
        return list.map((c) => ({
          id: c.slot,
          label: STAFF_NAMES[c.slot],
          right: `${formatMoney(wageOf(c))}$`,
          rightColor: this.sub === 0 ? C.basil : s.money >= wageOf(c) * 2 ? C.gold : C.tomato,
          sub: `${S.skill} ${'•'.repeat(c.skill)}  ${S.speed} ${'•'.repeat(c.speed)}`,
        }));
      }

      default:
        return [];
    }
  }

  private emptyText(): string {
    switch (this.tab) {
      case 1:
        return this.sub === 0 ? EMPTY.noPizzaInMenu : EMPTY.noProductInMenu;
      case 2:
        return this.sub === 0 ? EMPTY.noRecipes : EMPTY.allRecipes;
      case 3:
        return this.sub === 0 ? EMPTY.noIngredientSupply : EMPTY.allIngredientSupply;
      case 4:
        return this.sub === 0 ? EMPTY.noProductSupply : EMPTY.allProductSupply;
      case 5:
        return this.sub === 0 ? EMPTY.noAds : EMPTY.allAds;
      case 8:
        return this.sub === 0 ? EMPTY.noUpgrades : EMPTY.allUpgrades;
      case 9:
        return this.sub === 0 ? EMPTY.noMachines : EMPTY.allMachines;
      case 10:
        return this.sub === 0 ? EMPTY.noStaff : EMPTY.noCandidates;
      default:
        return '';
    }
  }

  private drawList(p: Painter, s: GameState): void {
    this.adjustHits = [];
    const rows = this.rows(s);
    if (rows.length === 0) {
      notice(p, this.emptyText(), LIST_AREA);
      return;
    }

    const rowH = 18;
    // Quantity / price screens need a taller detail pane for the clickable ± buttons.
    const detailH = this.adjustSteps(s) ? 28 : 24;
    const areaH = LIST_AREA.h - detailH;
    let cursor = this.cursor[this.tab];
    cursor = Math.max(0, Math.min(cursor, rows.length - 1));
    this.cursor[this.tab] = cursor;

    const win = listWindow(cursor, rows.length, rowH, areaH, this.first[this.tab]);
    this.first[this.tab] = win.first;

    for (let i = 0; i < win.visible; i++) {
      const idx = win.first + i;
      if (idx >= rows.length) break;
      const item = rows[idx];
      const y = LIST_AREA.y + i * rowH;
      row(p, LIST_AREA.x, y, LIST_AREA.w - 3, rowH, idx === cursor);

      let tx = LIST_AREA.x + 3;
      if (item.icon) {
        p.blit(item.icon, tx, y + Math.max(0, (rowH - item.icon.height) / 2));
        tx += item.icon.width + 3;
      }

      const rightEdge = LIST_AREA.x + LIST_AREA.w - 6;
      const valueW = item.right ? p.measure(item.right) + 4 : 0;
      p.textClipped(
        item.label,
        tx,
        y + 3,
        rightEdge - tx - valueW,
        item.dim ? C.inkFaint : idx === cursor ? C.selInk : C.ink,
      );
      if (item.right) {
        p.text(item.right, rightEdge, y + 3, item.rightColor ?? C.gold, 'right');
      }
      if (item.sub) {
        p.textClipped(item.sub, tx, y + 10, rightEdge - tx, C.inkFaint);
      }
    }

    scrollbar(
      p,
      { x: LIST_AREA.x + LIST_AREA.w - 4, y: LIST_AREA.y, w: 3, h: areaH },
      win.first,
      win.visible,
      rows.length,
    );

    this.drawDetail(p, s, rows[cursor], LIST_AREA.y + areaH, detailH);
  }

  private drawDetail(p: Painter, s: GameState, item: ListRow, y: number, h: number): void {
    p.fill(LIST_AREA.x, y, LIST_AREA.w, h, C.panelLo);
    p.hLine(LIST_AREA.x, y, LIST_AREA.w, C.line);

    const w = LIST_AREA.w - 8;
    switch (this.tab) {
      case 1: {
        const step = this.adjustSteps(s);
        if (step) {
          this.adjustHits = adjustButtons(
            p,
            { x: LIST_AREA.x, y, w: LIST_AREA.w, h },
            'ИЗМЕНЕНИЕ ЦЕНЫ',
            step.small,
            step.big,
            { suffix: '$' },
          );
        }
        break;
      }
      case 2:
        if (this.sub === 0) {
          fieldLine(p, 'МОЖНО ПРИГОТОВИТЬ', `${bakeableCount(s, item.id)}`, 4, y + 3, w);
          fieldLine(p, 'ГОТОВО НА СКЛАДЕ', `${s.pizzaStock[item.id]}`, 4, y + 12, w);
        } else {
          fieldLine(p, S.price, `${formatMoney(recipePrice(item.id))}$`, 4, y + 3, w);
          p.text('ВЫБОР — КУПИТЬ РЕЦЕПТ', 4, y + 12, C.orange);
        }
        break;
      case 3:
      case 4:
        if (this.sub === 0) {
          const step = this.adjustSteps(s);
          if (step) {
            this.adjustHits = adjustButtons(
              p,
              { x: LIST_AREA.x, y, w: LIST_AREA.w, h },
              'ИЗМЕНЕНИЕ КОЛИЧЕСТВА',
              step.small,
              step.big,
            );
          }
        } else {
          fieldLine(p, S.price, item.right ?? '', 4, y + 3, w);
          p.text('ВЫБОР — НАЛАДИТЬ ПОСТАВКУ', 4, y + 12, C.orange);
        }
        break;
      case 5:
        fieldLine(p, S.pricePerDay, `${formatMoney(ADS[item.id].dayCost)}$`, 4, y + 3, w);
        p.text(this.sub === 0 ? 'ВЫБОР — ОСТАНОВИТЬ' : 'ВЫБОР — ЗАПУСТИТЬ', 4, y + 12, C.orange);
        break;
      case 8:
        fieldLine(p, S.price, `${formatMoney(UPGRADES[item.id].cost)}$`, 4, y + 3, w);
        p.text(this.sub === 0 ? 'УСТАНОВЛЕНО' : 'ВЫБОР — УСТАНОВИТЬ', 4, y + 12, this.sub === 0 ? C.basil : C.orange);
        break;
      case 9:
        fieldLine(p, S.price, `${formatMoney(MACHINES[item.id].cost)}$`, 4, y + 3, w);
        p.text(this.sub === 0 ? 'ВЫБОР — ПРОДАТЬ ЗА ПОЛ ЦЕНЫ' : 'ВЫБОР — КУПИТЬ', 4, y + 12, C.orange);
        break;
      case 10: {
        const c = s.candidates.find((x) => x.slot === item.id);
        if (c) {
          fieldLine(p, S.salary, `${formatMoney(wageOf(c))}$/ДЕНЬ`, 4, y + 3, w);
          const hired = hiredOf(s, this.staffKind).length;
          p.text(
            this.sub === 0 ? 'ВЫБОР — УВОЛИТЬ (7 ДНЕЙ)' : `ВЫБОР — НАНЯТЬ (${hired}/${hireCap(s)})`,
            4,
            y + 12,
            C.orange,
          );
        }
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------------------ statistics

  private drawStats(p: Painter, s: GameState): void {
    const x = 4;
    let y = CONTENT.y + 14;
    const w = CONTENT.w - 10;

    p.text('РЕЙТИНГИ', x, y, C.orange);
    y += 10;

    const bars: Array<[string, number, string]> = [
      [s.playerName, s.rating, C.sky],
      ['КОНКУРЕНТ 1', s.rivalRating[0], C.tomato],
      ['КОНКУРЕНТ 2', s.rivalRating[1], C.basil],
    ];
    for (const [label, value, color] of bars) {
      if (value <= 0 && label !== s.playerName) continue;
      p.text(label, x, y, C.inkDim);
      p.text(formatRating(value), x + w, y, color, 'right');
      y += 8;
      p.bar(x, y, w, 4, value / 100000, color);
      y += 8;
    }

    y += 2;
    p.hLine(x, y, w, C.lineSoft);
    y += 3;

    fieldLine(p, S.currentTax, `${100 - s.netPct}%`, x, y, w, C.tomato);
    y += 9;
    fieldLine(p, 'МНОЖИТЕЛЬ', `x${scaleOf(s)}`, x, y, w, C.plum);
    y += 11;

    // Everything below resets at midnight, so say so plainly.
    p.text(`ЗА ДЕНЬ ${s.day + 1}`, x, y, C.orange);
    y += 10;

    const revenue = s.profits.pizza + s.profits.product + s.profits.machine + s.profits.delivery;
    const lines: Array<[string, string, string]> = [
      [S.profitPizza, `${formatMoney(s.profits.pizza)}$`, C.gold],
      [S.profitGoods, `${formatMoney(s.profits.product)}$`, C.gold],
      [S.profitMachines, `${formatMoney(s.profits.machine)}$`, C.gold],
      [S.profitDelivery, `${formatMoney(s.profits.delivery)}$`, C.gold],
      ['ПРОДАНО ПИЦЦ', `${s.soldToday}`, C.ink],
      [S.salaries, `-${formatMoney(dailySalary(s))}$`, C.tomato],
      [S.advertising, `-${formatMoney(dailyAdCost(s))}$`, C.tomato],
    ];
    for (const [label, value, color] of lines) {
      fieldLine(p, label, value, x, y, w, color);
      y += 9;
    }

    p.hLine(x, y, w, C.lineSoft);
    y += 3;
    const net = revenue - dailySalary(s) - dailyAdCost(s);
    fieldLine(p, 'ИТОГО', `${net >= 0 ? '+' : ''}${formatMoney(net)}$`, x, y, w, net >= 0 ? C.basil : C.tomato);
  }

  private drawTask(p: Painter, s: GameState): void {
    const m = missionOf(s);
    const x = 4;
    let y = CONTENT.y + 14;
    const w = CONTENT.w - 10;

    p.text(m.name, CONTENT.w / 2, y, C.gold, 'center');
    y += 12;

    const goals: Array<[string, string, boolean]> =
      m.goalType === 1
        ? [
            [S.goalSurvive, `${s.day} / ${m.days}`, s.day >= m.days],
            [S.goalRating, `${formatRating(s.rating)} / ${formatRating(m.goalRating)}`, s.rating >= m.goalRating],
          ]
        : [
            [S.goalEarn, `${formatMoney(s.money)} / ${formatMoney(m.goalMoney)}`, s.money >= m.goalMoney],
            [S.goalRating, `${formatRating(s.rating)} / ${formatRating(m.goalRating)}`, s.rating >= m.goalRating],
            [S.goalDays, `${s.day} / ${m.days}`, false],
          ];

    for (const [label, value, done] of goals) {
      p.text(done ? '✓' : '•', x, y, done ? C.basil : C.inkFaint);
      p.text(label, x + 8, y, C.inkDim);
      y += 9;
      p.text(value, x + w, y - 1, done ? C.basil : C.gold, 'right');
      y += 10;
    }

    y += 2;
    p.hLine(x, y, w, C.lineSoft);
    y += 4;
    p.paragraph(m.brief, x, y, w, C.inkFaint, 2);
  }

  // ------------------------------------------------------------------- map

  private drawMap(p: Painter, s: GameState): void {
    const m = missionOf(s);
    const area: Rect = { x: CONTENT.x, y: CONTENT.y + 11, w: CONTENT.w, h: CONTENT.h - 11 };

    // City backdrop: blocks and roads.
    p.fill(area.x, area.y, area.w, area.h, '#2b3a2c');
    for (let gy = area.y; gy < area.y + area.h; gy += 26) {
      p.fill(area.x, gy, area.w, 6, '#4a4a48');
      p.dottedLine(area.x, gy + 2, area.w, '#c9c0aa', 6);
    }
    for (let gx = 8; gx < area.w; gx += 34) {
      p.fill(area.x + gx, area.y, 6, area.h, '#4a4a48');
    }

    const place = (mx: number, my: number): { x: number; y: number } => ({
      x: area.x + 6 + Math.round((mx / 200) * (area.w - 20)),
      y: area.y + 8 + Math.round((my / 200) * (area.h - 26)),
    });

    const rivals: Array<[number, number, number, string, number]> = [
      [m.rival1Pos[0], m.rival1Pos[1], m.rival1House, C.tomato, s.rivalRating[0]],
      [m.rival2Pos[0], m.rival2Pos[1], m.rival2House, C.basil, s.rivalRating[1]],
    ];
    for (const [mx, my, house, color, rating] of rivals) {
      if (rating <= 0) continue;
      const pos = place(mx, my);
      drawHouse(p, pos.x, pos.y, house, color);
    }

    const me = place(m.pos[0], m.pos[1]);
    drawHouse(p, me.x, me.y, 0, C.sky);
    p.stroke(me.x - 8, me.y - 10, 17, 19, C.sky);
    p.text(s.playerName, me.x, me.y - 19, C.sky, 'center');
  }

  // ---------------------------------------------------------------- input

  private actionLabel(s: GameState): string {
    switch (this.tab) {
      case 2:
        return this.sub === 1 ? S.buy : '';
      case 3:
      case 4:
        return this.sub === 1 ? S.buy : '';
      case 5:
        return this.sub === 0 ? 'СТОП' : 'ПУСК';
      case 8:
        return this.sub === 1 ? 'СТАВИТЬ' : '';
      case 9:
        return this.sub === 0 ? S.sell : S.buy;
      case 10:
        return this.sub === 0 ? 'УВОЛИТЬ' : 'НАНЯТЬ';
      default:
        return s.speed === 0 ? 'ПУСК' : '';
    }
  }

  key(app: App, key: Key): void {
    const session = app.session;
    if (!session) return;
    const s = session.state;

    if (this.message) {
      this.message = null;
      this.messageTimer = 0;
      return;
    }

    switch (key) {
      case 'speedDown':
        s.speed = Math.max(0, s.speed - 1) as Speed;
        app.cue('select');
        return;
      case 'speedUp':
        s.speed = Math.min(3, s.speed + 1) as Speed;
        app.cue('select');
        return;
      case 'hint':
        app.push(new HelpScreen(HELP_BOOK, helpPageForTab(this.tab)));
        return;
      case 'menu':
        this.openMenu(app);
        return;
      case 'cheat':
        // The original's easter egg, kept as-is.
        s.money += 100000;
        log(s, 'НЕОЖИДАННОЕ ПОСТУПЛЕНИЕ: 100000$');
        app.cue('cash');
        return;
      case 'soft1':
        this.cycleSub(app, s);
        return;
      case 'prevTab':
        this.switchTab(app, -1);
        return;
      case 'nextTab':
        this.switchTab(app, 1);
        return;
      default:
        break;
    }

    if (key === 'back') {
      if (this.tabFocus) {
        this.tabFocus = false;
        return;
      }
      this.openMenu(app);
      return;
    }

    if (this.tabFocus) {
      this.tabStripKey(app, key);
      return;
    }

    this.contentKey(app, s, key);
  }

  private switchTab(app: App, delta: number): void {
    this.tab = (this.tab + delta + TAB_COUNT) % TAB_COUNT;
    this.sub = 0;
    this.tabFocus = false;
    app.cue('select');
  }

  private cycleSub(app: App, s: GameState): void {
    const subs = SUB_TABS[this.tab];
    if (subs.length < 2) return;
    if (this.tab === 10) {
      // Two axes: sub-tab toggles, and the employee category advances on wrap.
      this.sub = 1 - this.sub;
      if (this.sub === 0) this.staffKind = (this.staffKind + 1) % STAFF_KINDS.length;
    } else {
      this.sub = 1 - this.sub;
    }
    this.cursor[this.tab] = 0;
    this.first[this.tab] = 0;
    void s;
    app.cue('select');
  }

  private tabStripKey(app: App, key: Key): void {
    if (key === 'up') {
      this.tab = (this.tab + TAB_COUNT - 1) % TAB_COUNT;
      this.sub = 0;
      app.cue('select');
    } else if (key === 'down') {
      this.tab = (this.tab + 1) % TAB_COUNT;
      this.sub = 0;
      app.cue('select');
    } else if (key === 'select' || key === 'left') {
      this.tabFocus = false;
      app.cue('select');
    }
  }

  private contentKey(app: App, s: GameState, key: Key): void {
    const rows = this.rows(s);
    const count = rows.length;
    const cursor = this.cursor[this.tab];

    if (key === 'right') {
      if (this.tab === 0 || this.tab === 6 || this.tab === 7 || count === 0) {
        this.tabFocus = true;
        app.cue('select');
        return;
      }
    }

    switch (key) {
      case 'up':
        if (count === 0) {
          this.tabFocus = true;
        } else if (cursor === 0) {
          this.tabFocus = true;
        } else {
          this.cursor[this.tab] = cursor - 1;
        }
        return;
      case 'down':
        if (count > 0) this.cursor[this.tab] = Math.min(count - 1, cursor + 1);
        return;
      default:
        break;
    }

    if (count === 0) return;
    const id = rows[Math.min(cursor, count - 1)].id;

    const step = this.adjustSteps(s);
    if (step) {
      const delta =
        key === 'left' || key === 'sellSmall'
          ? -step.small
          : key === 'right' || key === 'buySmall'
            ? step.small
            : key === 'sellBig'
              ? -step.big
              : key === 'buyBig'
                ? step.big
                : 0;
      if (delta !== 0) {
        step.apply(id, delta);
        return;
      }
    }

    if (key === 'select') this.activate(app, s, id);
  }

  /** Left/right adjustment behaviour for the price and stock screens. */
  private adjustSteps(s: GameState): { small: number; big: number; apply: (id: number, delta: number) => void } | null {
    if (this.tab === 1) {
      return {
        small: 1,
        big: 10,
        apply: (id, d) => (this.sub === 0 ? adjustPizzaPrice(s, id, d) : adjustProductPrice(s, id, d)),
      };
    }
    if (this.tab === 3 && this.sub === 0) {
      return { small: 100, big: 1000, apply: (id, d) => tradeIngredient(s, id, d) };
    }
    if (this.tab === 4 && this.sub === 0) {
      return { small: 10, big: 100, apply: (id, d) => tradeProduct(s, id, d) };
    }
    return null;
  }

  private activate(app: App, s: GameState, id: number): void {
    const fail = (message: string): void => {
      app.cue('deny');
      this.message = message;
      this.messageTimer = 2200;
    };
    const done = (): void => app.cue('cash');

    switch (this.tab) {
      case 2:
        if (this.sub === 1) {
          this.confirm(app, CONFIRM.buyRecipe, () => {
            const r = buyRecipe(s, id);
            if (!r.ok) fail(r.message ?? '');
            else done();
          });
        }
        return;
      case 3:
        if (this.sub === 1) {
          this.confirm(app, CONFIRM.supplyIngredient, () => {
            const r = supplyIngredient(s, id);
            if (!r.ok) fail(r.message ?? '');
            else done();
          });
        }
        return;
      case 4:
        if (this.sub === 1) {
          this.confirm(app, CONFIRM.supplyProduct, () => {
            const r = supplyProduct(s, id);
            if (!r.ok) fail(r.message ?? '');
            else done();
          });
        }
        return;
      case 5:
        this.confirm(app, this.sub === 0 ? CONFIRM.stopAd : CONFIRM.startAd, () => {
          const r = this.sub === 0 ? stopAd(s, id) : startAd(s, id);
          if (!r.ok) fail(r.message ?? '');
          else done();
        });
        return;
      case 8:
        if (this.sub === 1) {
          this.confirm(app, CONFIRM.doUpgrade, () => {
            const r = installUpgrade(s, id);
            if (!r.ok) fail(r.message ?? '');
            else app.cue('upgrade');
          });
        }
        return;
      case 9:
        this.confirm(app, this.sub === 0 ? CONFIRM.sellMachine : CONFIRM.buyMachine, () => {
          const r = this.sub === 0 ? sellMachine(s, id) : buyMachine(s, id);
          if (!r.ok) fail(r.message ?? '');
          else done();
        });
        return;
      case 10:
        this.confirm(app, this.sub === 0 ? CONFIRM.fire : CONFIRM.hire, () => {
          const r = this.sub === 0 ? fire(s, id) : hire(s, id);
          if (!r.ok) fail(r.message ?? '');
          else done();
        });
        return;
      default:
        if (s.speed === 0) s.speed = 1;
        return;
    }
  }

  private confirm(app: App, text: string, onYes: () => void): void {
    app.push(new ConfirmScreen(text, () => onYes(), this));
  }

  private openMenu(app: App): void {
    app.push(new PauseScreen(this));
  }

  click(app: App, x: number, y: number): void {
    const session = app.session;
    if (!session) return;
    const s = session.state;

    if (this.message) {
      this.message = null;
      return;
    }

    // Tab strip.
    if (x >= SCREEN_W - TAB_STRIP_W && y >= TAB_TOP && y < TAB_TOP + TAB_COUNT * TAB_H) {
      const index = Math.floor((y - TAB_TOP) / TAB_H);
      if (index !== this.tab) {
        this.tab = index;
        this.sub = 0;
        app.cue('select');
      }
      this.tabFocus = false;
      return;
    }

    // Status bar: tap the clock area to pause or resume.
    if (y < TOP_BAR_H && x < 44) {
      s.speed = s.speed === 0 ? 1 : 0;
      app.cue('select');
      return;
    }

    // Bottom bar: left opens the menu, the middle flips the sub-screen, the
    // right acts on the selected row.
    if (y >= SCREEN_H - BOTTOM_BAR_H) {
      if (x < SCREEN_W / 3) this.openMenu(app);
      else if (x > (SCREEN_W * 2) / 3) this.key(app, 'select');
      else this.key(app, 'soft1');
      return;
    }

    // Sub-tab strip.
    const subs = SUB_TABS[this.tab];
    if (subs.length > 1 && y >= CONTENT.y && y < CONTENT.y + 11 && x < CONTENT.w) {
      if (this.tab === 10) this.cycleSub(app, s);
      else {
        const index = Math.min(subs.length - 1, Math.floor(x / (CONTENT.w / subs.length)));
        if (index !== this.sub) {
          this.sub = index;
          this.cursor[this.tab] = 0;
          this.first[this.tab] = 0;
          app.cue('select');
        }
      }
      return;
    }

    // Quantity / price ± buttons in the detail pane.
    for (const hit of this.adjustHits) {
      if (x >= hit.x && x < hit.x + hit.w && y >= hit.y && y < hit.y + hit.h) {
        const step = this.adjustSteps(s);
        const rows = this.rows(s);
        if (!step || rows.length === 0) return;
        const id = rows[Math.min(this.cursor[this.tab], rows.length - 1)].id;
        step.apply(id, hit.delta);
        app.cue(hit.delta > 0 ? 'cash' : 'select');
        return;
      }
    }

    // List rows: first tap selects, a tap on the selected row activates it.
    const rows = this.rows(s);
    if (rows.length === 0 || x >= CONTENT.w) return;
    const rowH = 18;
    const detailH = this.adjustSteps(s) ? 28 : 24;
    const areaH = LIST_AREA.h - detailH;
    if (y < LIST_AREA.y || y >= LIST_AREA.y + areaH) return;
    // Scrollbar track: jump the window.
    if (x >= LIST_AREA.x + LIST_AREA.w - 6) {
      const ratio = Math.max(0, Math.min(1, (y - LIST_AREA.y) / areaH));
      const visible = Math.max(1, Math.floor(areaH / rowH));
      this.first[this.tab] = Math.max(0, Math.min(rows.length - visible, Math.round(ratio * Math.max(0, rows.length - visible))));
      this.cursor[this.tab] = Math.max(this.first[this.tab], Math.min(this.first[this.tab] + visible - 1, this.cursor[this.tab]));
      app.cue('select');
      return;
    }
    const index = this.first[this.tab] + Math.floor((y - LIST_AREA.y) / rowH);
    if (index < 0 || index >= rows.length) return;
    if (index === this.cursor[this.tab]) this.activate(app, s, rows[index].id);
    else {
      this.cursor[this.tab] = index;
      app.cue('select');
    }
  }

  /**
   * Touch-drag / mouse-wheel scrolling for long lists (ingredients, products…).
   * Positive `dy` reveals lower rows.
   */
  onScroll(app: App, dy: number, x: number, y: number): void {
    const session = app.session;
    if (!session || this.message) return;
    if (this.tab === 0 || this.tab === 6 || this.tab === 7) return;
    if (x >= CONTENT.w) return;

    const rows = this.rows(session.state);
    if (rows.length === 0) return;
    const rowH = 18;
    const detailH = this.adjustSteps(session.state) ? 28 : 24;
    const areaH = LIST_AREA.h - detailH;
    if (y < LIST_AREA.y - 4 || y >= LIST_AREA.y + areaH + 4) return;

    this.scrollCarry += dy;
    const steps = Math.trunc(this.scrollCarry / rowH);
    if (steps === 0) return;
    this.scrollCarry -= steps * rowH;

    const visible = Math.max(1, Math.floor(areaH / rowH));
    const maxFirst = Math.max(0, rows.length - visible);
    this.first[this.tab] = Math.max(0, Math.min(maxFirst, this.first[this.tab] + steps));
    // Keep the selection inside the visible window so ↑/↓ stay coherent.
    const first = this.first[this.tab];
    if (this.cursor[this.tab] < first) this.cursor[this.tab] = first;
    if (this.cursor[this.tab] >= first + visible) this.cursor[this.tab] = first + visible - 1;
  }
}

// ---------------------------------------------------------------- pause menu

class PauseScreen implements Screen {
  private index = 0;
  private readonly items = [S.continue, S.save, S.hints, S.help, S.toMenu];

  constructor(private readonly under: Screen) {}

  draw(app: App, p: Painter): void {
    this.under.draw(app, p);
    p.setAlpha(0.65);
    p.fill(0, 0, SCREEN_W, SCREEN_H, '#000');
    p.setAlpha(1);

    const boxH = this.items.length * 16 + 16;
    const y = Math.round((SCREEN_H - boxH) / 2);
    p.panel(18, y, SCREEN_W - 36, boxH, { fill: C.panel });
    p.stroke(18, y, SCREEN_W - 36, boxH, C.gold);
    p.text('МЕНЮ', SCREEN_W / 2, y + 4, C.gold, 'center');

    this.items.forEach((label, i) => {
      const iy = y + 16 + i * 16;
      const on = i === this.index;
      if (on) {
        p.gradientV(22, iy - 2, SCREEN_W - 44, 13, C.selBgAlt, C.selBg);
        p.stroke(22, iy - 2, SCREEN_W - 44, 13, C.gold);
      }
      const text = i === 2 ? `${S.hints}: ${app.settings.hints ? S.on : S.off}` : label;
      p.text(text, SCREEN_W / 2, iy + 1, on ? C.selInk : C.ink, 'center');
    });
  }

  click(app: App, x: number, y: number): void {
    const boxH = this.items.length * 16 + 16;
    const top = Math.round((SCREEN_H - boxH) / 2) + 16;
    if (x < 22 || x > SCREEN_W - 22 || y < top - 2) {
      app.pop();
      return;
    }
    const index = Math.floor((y - top + 2) / 16);
    if (index < 0 || index >= this.items.length) return;
    this.index = index;
    this.key(app, 'select');
  }

  key(app: App, key: Key): void {
    if (key === 'up') this.index = (this.index + this.items.length - 1) % this.items.length;
    else if (key === 'down') this.index = (this.index + 1) % this.items.length;
    else if (key === 'back' || key === 'menu') app.pop();
    else if (key === 'select') {
      app.cue('select');
      switch (this.index) {
        case 0:
          app.pop();
          break;
        case 1:
          saveSession(app);
          app.pop();
          break;
        case 2:
          app.settings.hints = !app.settings.hints;
          app.persistSettings();
          break;
        case 3:
          app.push(new HelpScreen(HELP_BOOK));
          break;
        default:
          app.pop();
          app.push(
            new ConfirmScreen(
              CONFIRM.quitToMenu,
              (a) => {
                a.endSession();
                a.reset(new MenuScreen());
              },
              this.under,
            ),
          );
          break;
      }
    }
  }
}

// -------------------------------------------------------------------- utils

const pizzaThumbs = new Map<number, HTMLCanvasElement>();

function pizzaThumb(index: number): HTMLCanvasElement {
  const hit = pizzaThumbs.get(index);
  if (hit) return hit;
  const canvas = pizzaSprite(PIZZAS[index].ingredients, index + 1);
  pizzaThumbs.set(index, canvas);
  return canvas;
}

function drawHouse(p: Painter, x: number, y: number, variant: number, color: string): void {
  const w = 15;
  const h = 16;
  p.fill(x - 7, y - 8, w, h, '#8a6a44');
  p.fill(x - 8, y - 11, w + 2, 3, color);
  p.fill(x - 5, y - 5, 4, 4, '#d8e4ea');
  p.fill(x + 1, y - 5, 4, 4, '#d8e4ea');
  p.fill(x - 2, y + 2, 5, 6, '#4a2f1a');
  if (variant >= 2) p.fill(x - 5, y + 2, 3, 3, '#d8e4ea');
  if (variant >= 3) p.fill(x + 3, y + 2, 3, 3, '#d8e4ea');
  p.stroke(x - 7, y - 8, w, h, '#5c3d22');
}
