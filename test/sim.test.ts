import assert from 'node:assert/strict';
import test from 'node:test';

import { PIZZAS, UPGRADE_TABLES } from '../src/data/content.ts';
import { MISSIONS } from '../src/data/missions.ts';
import { Rng } from '../src/game/rng.ts';
import {
  createContext,
  pizzaAcceptance,
  pedestrianCap,
  productAcceptance,
  tick,
  warnings,
} from '../src/game/sim.ts';
import {
  TICKS_PER_DAY,
  TICK_OPEN,
  TICK_SALARY,
  buyRecipe,
  clockOf,
  createGame,
  hireCap,
  hiredOf,
  installUpgrade,
  scaleOf,
  taxPercent,
  wageOf,
} from '../src/game/state.ts';
import { bootstrap, hireBest, manage } from './harness.ts';

function newGame(mission = 0, difficulty: 0 | 1 | 2 = 1) {
  return createGame(
    { playerName: 'ТЕСТ', difficulty, campaign: false, missionIndex: mission },
    new Rng(99),
  );
}

// -------------------------------------------------------------------- setup

test('a new mission starts from the values in the mission table', () => {
  const s = newGame(0);
  const m = MISSIONS[0];
  assert.equal(s.money, m.money);
  assert.equal(s.rating, m.rating);
  assert.equal(s.assets, m.assets);
  assert.equal(s.rivalRating[0], m.rival1Rating);
  assert.equal(s.pizzaPrice.every((p) => p === 0), true);
});

test('difficulty raises the tax by five points a step', () => {
  assert.equal(taxPercent(newGame(0, 0)), 1);
  assert.equal(taxPercent(newGame(0, 1)), 6);
  assert.equal(taxPercent(newGame(0, 2)), 11);
  assert.equal(taxPercent(newGame(6, 1)), 25);
});

test('the prestige multiplier follows (assets + rating) / 19000', () => {
  const s = newGame(0);
  assert.equal(scaleOf(s), Math.floor((s.assets + s.rating) / 19000));
});

test('the job market offers twenty candidates spread over five professions', () => {
  const s = newGame(0);
  assert.equal(s.candidates.length, 20);
  for (let type = 0; type < 5; type++) {
    const count = s.candidates.filter((c) => c.type === type).length;
    assert.ok(count > 0 && count <= 4, `profession ${type} has ${count} candidates`);
  }
});

test('wages follow speed squared times 37 plus skill squared times 43', () => {
  assert.equal(wageOf({ speed: 1, skill: 1 }), 80);
  assert.equal(wageOf({ speed: 5, skill: 5 }), 2000);
});

test('the second floor doubles the hire cap', () => {
  const s = newGame(0);
  assert.equal(hireCap(s), 1);
  s.money = 100000;
  installUpgrade(s, 0);
  assert.equal(hireCap(s), 2);
});

// ------------------------------------------------------------------ pricing

test('pizza acceptance is certain up to a doubled price and gone at triple', () => {
  assert.ok(pizzaAcceptance(100, 100) >= 100);
  assert.ok(pizzaAcceptance(200, 100) >= 100);
  assert.ok(pizzaAcceptance(290, 100) > 0 && pizzaAcceptance(290, 100) < 20);
  assert.ok(pizzaAcceptance(300, 100) <= 0);
});

test('products tolerate a slightly higher markup than pizzas', () => {
  assert.ok(productAcceptance(220, 100) >= 100);
  assert.ok(productAcceptance(220, 100) > pizzaAcceptance(220, 100));
});

test('buying a recipe charges a hundred times cost and books half as an asset', () => {
  const s = newGame(0);
  const money = s.money;
  const assets = s.assets;
  assert.equal(buyRecipe(s, 0).ok, true);
  assert.equal(s.money, money - 3700);
  assert.equal(s.assets, assets + 1850);
  assert.equal(s.pizzaPrice[0], PIZZAS[0].cost);
});

test('a purchase is refused when the money is not there', () => {
  const s = newGame(0);
  s.money = 10;
  const result = buyRecipe(s, 0);
  assert.equal(result.ok, false);
  assert.match(result.message ?? '', /ДЕНЕГ/);
});

// --------------------------------------------------------------------- time

test('the clock reads out of the tick counter', () => {
  const s = newGame(0);
  s.tick = 0;
  assert.equal(clockOf(s), '00:00');
  s.tick = TICK_OPEN;
  assert.equal(clockOf(s), '07:15');
  s.tick = TICKS_PER_DAY - 1;
  assert.equal(clockOf(s), '23:59');
});

test('the street fills up during the day and empties at night', () => {
  const s = newGame(0);
  s.tick = 100;
  assert.equal(pedestrianCap(s), 0);
  s.tick = 7200;
  assert.ok(pedestrianCap(s) >= 10);
  s.tick = 13000;
  assert.ok(pedestrianCap(s) > 0 && pedestrianCap(s) < 10);
});

// ----------------------------------------------------------- closing time

test('staff keep working after close until guests and litter are gone', () => {
  const rng = new Rng(42);
  const s = createGame(
    { playerName: 'ТЕСТ', difficulty: 1, campaign: false, missionIndex: 0 },
    rng,
  );
  installUpgrade(s, UPGRADE_TABLES);
  hireBest(s, 0);
  hireBest(s, 1);
  hireBest(s, 3);
  const cook = s.candidates.find((c) => c.hired && c.type === 0)!;
  const waiter = s.candidates.find((c) => c.hired && c.type === 1)!;
  const cleaner = s.candidates.find((c) => c.hired && c.type === 3)!;
  assert.ok(cook && waiter && cleaner);

  const ctx = createContext(s, rng);
  const w = ctx.world;
  const staffOf = (type: number) => w.staff.find((st) => st.type === type);

  const mkStaff = (c: typeof cook, x: number, y: number) => {
    w.staff.push({
      kind: 'staff',
      id: w.nextId++,
      type: c.type,
      slot: c.slot,
      speed: c.speed,
      skill: c.skill,
      x,
      y,
      tx: x,
      ty: y,
      state: 'idle',
      timer: 0,
      target: -1,
      carrying: false,
      facing: 1,
      anim: 0,
    });
  };
  mkStaff(cook, 80, 60);
  mkStaff(waiter, 100, 100);
  mkStaff(cleaner, 60, 132);

  w.customers.push({
    kind: 'customer',
    id: w.nextId++,
    seed: 1,
    x: 120,
    y: 120,
    tx: 120,
    ty: 120,
    state: 'served',
    timer: 30,
    table: 0,
    seat: 0,
    machine: -1,
    mood: 0,
    bubble: -1,
    bubbleTimer: 0,
    facing: 1,
    anim: 0,
  });
  w.seats[0][0] = true;
  s.litter.push({ x: 90, y: 130, kind: 0 }, { x: 110, y: 125, kind: 1 });

  s.tick = TICK_SALARY - 1;
  s.open = true;
  tick(ctx);

  assert.equal(s.open, false, 'pizzeria closed at salary time');
  assert.ok(w.customers.length > 0, 'guest still inside');
  assert.ok(staffOf(0) && staffOf(0)!.state !== 'leave', 'cook stays for the guest');
  assert.ok(staffOf(1) && staffOf(1)!.state !== 'leave', 'waiter stays for the guest');
  assert.ok(staffOf(3) && staffOf(3)!.state !== 'leave', 'cleaner stays for the guest');

  // Let the guest finish and walk out.
  let guard = 0;
  while (w.customers.length > 0 && guard++ < 5000) tick(ctx);
  assert.equal(w.customers.length, 0, 'last guest left');

  // Top up litter so the cleaner still has work after the guest's own scraps.
  s.litter.push({ x: 70, y: 128, kind: 0 }, { x: 100, y: 135, kind: 2 }, { x: 130, y: 122, kind: 1 });

  // One tick after the last guest: non-cleaners head for the door, cleaner stays.
  tick(ctx);
  assert.ok(!staffOf(0) || staffOf(0)!.state === 'leave', 'cook leaves after last guest');
  assert.ok(!staffOf(1) || staffOf(1)!.state === 'leave', 'waiter leaves after last guest');
  assert.ok(staffOf(3), 'cleaner is still on duty');
  assert.notEqual(staffOf(3)!.state, 'leave', 'cleaner does not leave while litter remains');
  assert.ok(s.litter.length > 0, 'litter still on the floor');

  // Cleaner clears the floor, then leaves.
  guard = 0;
  while (staffOf(3) && guard++ < 8000) tick(ctx);
  assert.equal(s.litter.length, 0, 'floor is clean');
  assert.equal(staffOf(3), undefined, 'cleaner left after the last scrap');
});

// ----------------------------------------------------------------- warnings

test('warnings light the tabs that need attention', () => {
  const s = newGame(0);
  const flags = warnings(s);
  assert.equal(flags[2], true, 'no recipes bought yet');
  assert.equal(flags[8], true, 'no tables installed');
  assert.equal(flags[10], true, 'no cook and no waiter');

  installUpgrade(s, UPGRADE_TABLES);
  assert.equal(warnings(s)[8], false);
});

// ------------------------------------------------------------ the whole loop

test('a well-run pizzeria serves guests and turns a profit over a full day', () => {
  const ctx = bootstrap({ mission: 0, seed: 4242 });
  const s = ctx.state;
  assert.ok(hiredOf(s, 0).length > 0, 'a cook was hired');
  assert.ok(hiredOf(s, 1).length > 0, 'a waiter was hired');

  const startDay = s.day;
  let guard = 0;
  while (s.day === startDay && !s.ending && guard++ < 40000) {
    tick(ctx);
    if (s.tick % 1200 === 0) manage(s, 1.8);
  }

  assert.equal(s.ending, null, 'the mission is still running');
  assert.equal(s.day, startDay + 1, 'exactly one day passed');
  assert.ok(s.rating > 10000, `rating held up (${s.rating})`);
});

test('a whole campaign mission can be played out without the engine breaking', () => {
  for (const mission of [0, 3, 6, 9]) {
    const ctx = bootstrap({ mission, seed: 777 });
    const s = ctx.state;
    let guard = 0;
    while (!s.ending && s.day < MISSIONS[mission].days + 2 && guard++ < 400000) {
      tick(ctx);
      if (s.tick % 1200 === 0) manage(s, 1.9);
    }
    assert.ok(s.ending !== null, `mission ${mission + 1} reached an ending`);
    assert.ok(Number.isFinite(s.money), `mission ${mission + 1} money stayed a number`);
    assert.ok(s.rating >= 0, `mission ${mission + 1} rating stayed positive`);
  }
});

test('rating never leaks: the player and the rivals stay near a hundred percent', () => {
  const ctx = bootstrap({ mission: 1, seed: 31337 });
  const s = ctx.state;
  let guard = 0;
  while (!s.ending && s.day < 3 && guard++ < 100000) {
    tick(ctx);
    if (s.tick % 1200 === 0) manage(s, 1.8);
  }
  const total = s.rating + Math.max(0, s.rivalRating[0]) + Math.max(0, s.rivalRating[1]);
  assert.ok(total >= 95000 && total <= 105000, `total rating stayed sane (${total})`);
});
