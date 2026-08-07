import { PIZZAS, PRODUCTS, MACHINES, UPGRADES } from '../data/content.ts';
import type { Rng } from './rng.ts';
import {
  createWorld,
  freeSeat,
  machinePos,
  seatPos,
  step,
  DOOR,
  KITCHEN_Y,
  OVEN_XS,
  ROOM_W,
  TABLES,
  type Customer,
  type CustomerState,
  type Staff,
  type World,
} from './entities.ts';
import {
  TICKS_PER_DAY,
  TICK_FIRST_CUSTOMER,
  TICK_LAST_CUSTOMER,
  TICK_OPEN,
  TICK_SALARY,
  bakeableCount,
  dailyAdCost,
  dailySalary,
  entityCap,
  hasTables,
  hiredOf,
  installedMachines,
  log,
  missionOf,
  ownedRecipes,
  scaleOf,
  staffStat,
  type GameState,
} from './state.ts';

/**
 * The simulation, ported from the original's per-tick loop.
 *
 * Formulas that came straight out of the bytecode are marked with the source
 * line. Three places deliberately deviate; they are collected in DEVIATIONS
 * below and explained in the README, because the original code there is plainly
 * inverted and makes whole systems useless.
 */

export const DEVIATIONS = {
  /**
   * Original: the drunk-brawl roll only ran `if (guards > 0)`, so hiring no
   * guard meant no brawls ever and hiring a weak one caused them. Here no guard
   * means the full 25 % risk, and guards reduce it — which is what the in-game
   * help text promises.
   */
  guardsReduceBrawls: true,
  /**
   * Original: delivery income read the *cleaners'* stats and litter-cleaning
   * speed read the *drivers'* stats. Swapped back here.
   */
  driversDoDeliveries: true,
  /**
   * Original: advertising and cosmetic upgrades affected nothing but the asset
   * value M. They now also give a bounded footfall bonus, so that "реклама
   * увеличивает посещаемость" is actually true.
   */
  adsAffectFootfall: true,
} as const;

const CUSTOMER_SPEED = 0.75;
/**
 * How long a seated guest will wait, in ticks. The original used 300 (half a
 * game hour) which no single waiter could ever meet, so almost every visitor
 * left angry; an hour of patience makes a well-staffed pizzeria viable while a
 * badly-staffed one still bleeds rating.
 */
const PATIENCE = 600;
/** Chance of a drunken scene when alcohol is sold and nobody is on the door. */
const UNGUARDED_BRAWL_CHANCE = 12;
/**
 * Staff move a good deal faster than customers. The original moved everyone on a
 * coarse tile grid; here the speed is tuned so that one waiter can actually keep
 * up with a full room, which is what the rating economy assumes.
 */
const STAFF_SPEED = 2.0;

/** Mood indices, matching MOODS in data/strings.ts. */
export const MOOD = {
  happy: 0,
  tooExpensive: 1,
  poorChoice: 2,
  outOfStock: 3,
  drunk: 4,
  poisoned: 5,
  scared: 6,
  unserved: 7,
} as const;

/** Rating delta per mood, before scaling (C.java:5186-5217). */
const MOOD_RATING = [61, -10, -3, -5, -60, -80, -50, -15];

/**
 * The original multiplied every *negative* mood by the rivals' combined strength
 * but left a satisfied guest at a flat +61. On the late missions that weight
 * reaches 21, so a single sold-out drink (-3 x 21 = -63) outweighed a perfectly
 * served guest and the mission was lost on day one no matter how well it was
 * played. Letting the reward scale with the same weight keeps the "rivals get
 * nastier" intent while leaving a well-run pizzeria able to climb.
 */
const happyReward = (weight: number): number => MOOD_RATING[0] + 6 * weight;

export interface SimContext {
  state: GameState;
  world: World;
  rng: Rng;
}

export function createContext(state: GameState, rng: Rng): SimContext {
  return { state, world: createWorld(), rng };
}

// ------------------------------------------------------------------- footfall

/** `var_byte_e` — how many pedestrians the street holds at this hour (C.java:4796). */
export function pedestrianCap(s: GameState): number {
  const g = s.tick;
  let base: number;
  if (g < 3000) base = 0;
  else if (g <= 4200 || g >= 12600) base = 3;
  else if (g <= 5400 || g >= 11400) base = 9;
  else base = 10 + Math.floor(s.missionIndex / 3);

  if (base === 0) return 0;
  return base + footfallBonus(s);
}

/** Bounded bonus from advertising and cosmetic upgrades (see DEVIATIONS). */
export function footfallBonus(s: GameState): number {
  if (!DEVIATIONS.adsAffectFootfall) return 0;
  const ads = s.ads.filter(Boolean).length;
  const cosmetic = UPGRADES.reduce((n, _, i) => (i >= 1 && i <= 5 && s.upgrades[i] ? n + 1 : n), 0);
  return Math.min(6, Math.round(ads * 0.7)) + Math.floor(cosmetic / 2);
}

/** Chance that a pedestrian at the door actually comes in (C.java:6503). */
export function entryChance(s: GameState): number {
  const ads = s.ads.filter(Boolean).length;
  const bonus = DEVIATIONS.adsAffectFootfall ? Math.min(15, ads * 2) : 0;
  return 80 + bonus;
}

// ---------------------------------------------------------------------- tick

export function tick(ctx: SimContext): void {
  const { state: s, world: w } = ctx;
  if (s.ending) return;

  s.tick++;

  if (s.tick === TICK_OPEN) {
    s.open = true;
    log(s, 'ПИЦЦЕРИЯ ОТКРЫТА');
    spawnStaff(ctx);
  }

  updateStreet(ctx);
  updateCars(ctx);
  updateStaff(ctx);
  updateCustomers(ctx);
  updateMachines(w);
  updateDelivery(ctx);

  // 19:00 — warn while there is still time to sell stock back.
  if (s.tick === 11400) {
    const due = dailySalary(s) + dailyAdCost(s);
    if (due > 0 && s.money < due) {
      log(s, `НЕ ХВАТАЕТ НА ВЫПЛАТЫ: НУЖНО ${due}$`);
    }
  }

  if (s.tick === TICK_SALARY) {
    const wages = dailySalary(s);
    if (wages > 0) {
      s.money -= wages;
      log(s, `ВЫПЛАЧЕНЫ ЗАРПЛАТЫ: ${wages}$`);
    }
    s.open = false;
    for (const st of w.staff) st.state = 'leave';
    if (s.money < 0) {
      finish(s, 'bankrupt');
      return;
    }
  }

  if (s.tick >= TICKS_PER_DAY) endDay(ctx);
}

// ------------------------------------------------------------------- street

function updateStreet(ctx: SimContext): void {
  const { state: s, world: w, rng } = ctx;
  const cap = pedestrianCap(s);

  if (w.spawnCooldown > 0) w.spawnCooldown--;
  if (w.walkers.length < cap && w.spawnCooldown <= 0 && rng.chance(8)) {
    const dir: 1 | -1 = rng.chance(50) ? 1 : -1;
    w.walkers.push({
      id: w.nextId++,
      seed: rng.int(1, 9999),
      x: dir === 1 ? -10 : ROOM_W + 10,
      // Pavement band is y 96–118; keep feet on the sidewalk, not the road.
      y: 108 + rng.int(0, 6),
      dir,
      decided: false,
      anim: 0,
    });
    w.spawnCooldown = 5;
  }

  for (let i = w.walkers.length - 1; i >= 0; i--) {
    const p = w.walkers[i];
    p.x += p.dir * 0.4;
    p.anim += 0.4;

    if (!p.decided && Math.abs(p.x - DOOR.x) < 2) {
      p.decided = true;
      if (tryEnter(ctx, p.seed)) {
        w.walkers.splice(i, 1);
        continue;
      }
    }
    if (p.x < -14 || p.x > ROOM_W + 14) w.walkers.splice(i, 1);
  }
}

/** Road traffic and pizza delivery vans on the exterior street. */
function updateCars(ctx: SimContext): void {
  const { state: s, world: w, rng } = ctx;

  for (let i = w.cars.length - 1; i >= 0; i--) {
    const car = w.cars[i];
    car.x += car.dir * car.speed;
    if (car.x < -44 || car.x > ROOM_W + 44) w.cars.splice(i, 1);
  }

  if (w.carCooldown > 0) w.carCooldown--;
  const hour = s.tick / 600; // TICKS_PER_HOUR — keep local to avoid a circular import pull
  const night = hour < 6 || hour >= 21;
  const trafficCount = w.cars.filter((c) => c.kind === 'traffic').length;
  const maxTraffic = night ? 1 : 3;
  if (trafficCount < maxTraffic && w.carCooldown <= 0 && rng.chance(night ? 2 : 4)) {
    spawnCar(ctx, 'traffic');
    w.carCooldown = night ? rng.int(80, 160) : rng.int(35, 90);
  }
}

/**
 * Road layout (room y): pavement 96–118, road 118–170, centre line at 144.
 * Top lane (above the line) drives left; bottom lane drives right.
 */
const ROAD_LANE_TOP_Y = 140;
const ROAD_LANE_BOTTOM_Y = 164;

function spawnCar(ctx: SimContext, kind: 'traffic' | 'delivery'): void {
  const { world: w, rng } = ctx;
  if (kind === 'delivery' && w.cars.some((c) => c.kind === 'delivery')) return;
  // Top of road → left (−1), bottom → right (+1).
  const dir: 1 | -1 = rng.chance(50) ? 1 : -1;
  const lane = dir === 1 ? ROAD_LANE_BOTTOM_Y : ROAD_LANE_TOP_Y;
  w.cars.push({
    id: w.nextId++,
    kind,
    seed: rng.int(1, 9999),
    x: dir === 1 ? -34 : ROOM_W + 34,
    y: lane,
    dir,
    speed: kind === 'delivery' ? 0.85 + rng.int(0, 20) / 100 : 0.55 + rng.int(0, 35) / 100,
  });
}

/** A pedestrian at the door decides whether to become a customer (C.java:6486). */
function tryEnter(ctx: SimContext, seed: number): boolean {
  const { state: s, world: w, rng } = ctx;
  if (s.tick < TICK_FIRST_CUSTOMER || s.tick > TICK_LAST_CUSTOMER) return false;
  if (!s.open) return false;
  if (w.customers.length + w.staff.length >= entityCap(s)) return false;
  if (!rng.chance(entryChance(s))) return false;

  const customer: Customer = {
    kind: 'customer',
    id: w.nextId++,
    seed,
    x: DOOR.x,
    y: DOOR.y,
    tx: DOOR.x,
    ty: DOOR.y,
    state: 'enter',
    timer: 0,
    table: -1,
    seat: -1,
    machine: -1,
    mood: -1,
    bubble: -1,
    bubbleTimer: 0,
    facing: 1,
    anim: 0,
  };

  // Litter scares people away once there is more than a little of it (C.java:5032).
  const litter = s.litter.length - 4;
  const scare = litter > 0 ? litter * litter : 0;
  if (scare > 0 && rng.chance(scare)) {
    customer.mood = MOOD.scared;
    leave(customer, w);
    w.customers.push(customer);
    return true;
  }

  if (rng.chance(80)) {
    // Wants a table.
    if (!hasTables(s)) {
      customer.mood = MOOD.unserved;
      leave(customer, w);
    } else {
      const seat = freeSeat(w, (a, b) => rng.int(a, b));
      if (!seat) {
        customer.mood = MOOD.unserved;
        leave(customer, w);
      } else {
        w.seats[seat.table][seat.seat] = true;
        customer.table = seat.table;
        customer.seat = seat.seat;
        const p = seatPos(seat.table, seat.seat);
        customer.tx = p.x;
        customer.ty = p.y;
      }
    }
  } else {
    // Wants a vending machine.
    const free = installedMachines(s).filter((i) => w.machineBusy[i] <= 0);
    if (free.length === 0) {
      customer.mood = MOOD.unserved;
      leave(customer, w);
    } else {
      const m = free[rng.int(0, free.length - 1)];
      customer.machine = m;
      w.machineBusy[m] = 20;
      const p = machinePos(m);
      customer.tx = p.x + 8;
      customer.ty = p.y;
    }
  }

  w.customers.push(customer);
  return true;
}

// ----------------------------------------------------------------- customers

function updateCustomers(ctx: SimContext): void {
  const { world: w } = ctx;

  for (let i = w.customers.length - 1; i >= 0; i--) {
    const c = w.customers[i];
    if (c.bubbleTimer > 0) c.bubbleTimer--;

    switch (c.state) {
      case 'enter': {
        if (step(c, CUSTOMER_SPEED)) {
          if (c.machine >= 0) {
            c.state = 'machine';
            c.timer = 20;
          } else {
            c.state = 'wait';
            c.timer = PATIENCE;
          }
        }
        dropLitter(ctx, c);
        break;
      }
      case 'wait': {
        if (--c.timer <= 0) {
          c.mood = MOOD.unserved;
          leave(c, w);
        }
        break;
      }
      case 'ordered': {
        if (--c.timer <= 0) {
          c.mood = MOOD.unserved;
          leave(c, w);
        }
        break;
      }
      case 'served': {
        if (--c.timer <= 0) leave(c, w);
        break;
      }
      case 'machine': {
        if (--c.timer <= 0) {
          payMachine(ctx, c.machine);
          c.mood = -1;
          leave(c, w);
        }
        break;
      }
      case 'leave': {
        if (step(c, CUSTOMER_SPEED)) {
          applyMood(ctx, c);
          w.customers.splice(i, 1);
          continue;
        }
        dropLitter(ctx, c);
        break;
      }
    }
  }
}

function leave(c: Customer, w: World): void {
  releaseSeat(w, c);
  c.state = 'leave';
  c.tx = DOOR.x;
  c.ty = DOOR.y + 10;
  if (c.mood >= 0) {
    c.bubble = c.mood;
    c.bubbleTimer = 90;
  }
}

function releaseSeat(w: World, c: Customer): void {
  if (c.table >= 0 && c.seat >= 0) w.seats[c.table][c.seat] = false;
}

/** 3 % chance per movement segment to drop a piece of litter (C.java:6728). */
function dropLitter(ctx: SimContext, c: Customer): void {
  const { state: s, rng } = ctx;
  if (s.litter.length >= 16) return;
  if (!rng.chance(0.35)) return;
  s.litter.push({ x: Math.round(c.x), y: Math.round(c.y), kind: rng.int(0, 3) });
}

/** Applies the rating transfer a departing customer causes (C.java:5183). */
function applyMood(ctx: SimContext, c: Customer): void {
  const { state: s, rng } = ctx;
  if (c.mood < 0) return;

  s.moods[c.mood] = (s.moods[c.mood] ?? 0) + 1;

  const mission = missionOf(s);
  const weight = mission.rival1Strength + mission.rival2Strength + s.difficulty;
  const raw = c.mood === MOOD.happy ? happyReward(weight) : MOOD_RATING[c.mood] * weight;
  const anyRival = s.rivalRating[0] > 0 || s.rivalRating[1] > 0;
  if (!anyRival) return;

  const delta = Math.trunc((raw * scaleOf(s) + 1) / 2);
  s.rating += delta;

  const [r1, r2] = s.rivalRating;
  if (r1 > 0 && r2 <= 0) s.rivalRating[0] -= delta;
  else if (r2 > 0 && r1 <= 0) s.rivalRating[1] -= delta;
  else if (rng.int(1, 2) === 1) s.rivalRating[0] -= delta;
  else s.rivalRating[1] -= delta;

  knockOut(s, 0);
  knockOut(s, 1);

  if (s.rating < 10000 && (s.rivalRating[0] > 0 || s.rivalRating[1] > 0)) finish(s, 'rating');
}

/** A rival that falls below 10 % is eliminated (C.java:5238). */
function knockOut(s: GameState, i: number): void {
  const other = i === 0 ? 1 : 0;
  const v = s.rivalRating[i];
  if (v <= 0 || v >= 10000) return;
  if (s.rivalRating[other] <= 0) {
    s.rivalRating[i] = 0;
    s.rating = 100000;
    log(s, 'КОНКУРЕНТ РАЗОРЁН! МОНОПОЛИЯ!');
  } else {
    const half = Math.floor(v / 2);
    s.rivalRating[other] += v - half;
    s.rivalRating[i] = 0;
    s.rating += half;
    log(s, 'КОНКУРЕНТ РАЗОРЁН!');
  }
}

/** Vending machine payout (C.java:5336). */
function payMachine(ctx: SimContext, index: number): void {
  const { state: s, rng } = ctx;
  if (index < 0) return;
  const gain = Math.floor((scaleOf(s) * s.netPct * rng.int(1, 3) * MACHINES[index].cost) / 5000);
  s.money += gain;
  s.profits.machine += gain;
}

function updateMachines(w: World): void {
  for (let i = 0; i < w.machineBusy.length; i++) if (w.machineBusy[i] > 0) w.machineBusy[i]--;
}

// --------------------------------------------------------------------- staff

function spawnStaff(ctx: SimContext): void {
  const { state: s, world: w, rng } = ctx;
  w.staff = [];
  for (const c of s.candidates) {
    if (!c.hired) continue;
    // Drivers are out on the road all day and never appear in the dining room,
    // exactly as in the original.
    if (c.type === 2) continue;
    const home = staffStation(c.type, rng);
    w.staff.push({
      kind: 'staff',
      id: w.nextId++,
      type: c.type,
      slot: c.slot,
      speed: c.speed,
      skill: c.skill,
      x: DOOR.x,
      y: DOOR.y,
      tx: home.x,
      ty: home.y,
      state: 'arrive',
      timer: rng.int(0, 300),
      target: -1,
      carrying: false,
      facing: 1,
      anim: 0,
    });
  }
}

function staffStation(type: number, rng: Rng): { x: number; y: number } {
  switch (type) {
    case 0:
      return { x: OVEN_XS[rng.int(0, OVEN_XS.length - 1)], y: KITCHEN_Y + 12 };
    case 1:
      return { x: 90, y: KITCHEN_Y + 20 };
    case 3:
      return { x: 60, y: 132 };
    case 4:
      return { x: 145, y: 138 };
    default:
      return { x: 100, y: 140 };
  }
}

function updateStaff(ctx: SimContext): void {
  const { world: w, rng } = ctx;

  for (let i = w.staff.length - 1; i >= 0; i--) {
    const st = w.staff[i];
    const speed = STAFF_SPEED + st.speed * 0.18;

    if (st.state === 'arrive') {
      if (st.timer > 0) {
        st.timer--;
        continue;
      }
      if (step(st, speed)) st.state = 'idle';
      continue;
    }

    if (st.state === 'leave') {
      st.tx = DOOR.x;
      st.ty = DOOR.y + 10;
      if (step(st, speed)) w.staff.splice(i, 1);
      continue;
    }

    if (st.state === 'busy') {
      if (--st.timer <= 0) st.state = 'idle';
      continue;
    }

    switch (st.type) {
      case 0:
        updateCook(ctx, st, speed);
        break;
      case 1:
        updateWaiter(ctx, st, speed);
        break;
      case 3:
        updateCleaner(ctx, st, speed);
        break;
      default:
        updatePatrol(ctx, st, speed, rng);
        break;
    }
  }
}

// ---------------------------------------------------------------------- cook

function updateCook(ctx: SimContext, st: Staff, speed: number): void {
  const { rng } = ctx;
  if (st.state === 'idle') {
    const oven = OVEN_XS[rng.int(0, OVEN_XS.length - 1)];
    st.tx = oven;
    st.ty = KITCHEN_Y + 12;
    st.state = 'toOven';
    return;
  }
  if (st.state === 'toOven' && step(st, speed)) {
    bake(ctx);
    st.state = 'busy';
    st.timer = rng.int(5, 10) * 6;
  }
}

/** Bakes the least-stocked affordable recipe (C.java:5928). */
export function bake(ctx: SimContext): void {
  const { state: s } = ctx;
  const cookSpeed = staffStat(s, 0, 'speed');
  if (cookSpeed <= 0) return;
  const ceiling = 30 + 3 * s.missionIndex;

  let best = -1;
  let bestStock = Infinity;
  let bestBatch = 0;
  for (const r of ownedRecipes(s)) {
    if (s.pizzaStock[r] >= ceiling) continue;
    const batch = Math.min(cookSpeed * 5, bakeableCount(s, r), ceiling - s.pizzaStock[r]);
    if (batch <= 0) continue;
    if (s.pizzaStock[r] < bestStock) {
      best = r;
      bestStock = s.pizzaStock[r];
      bestBatch = batch;
    }
  }
  if (best < 0) return;

  const p = PIZZAS[best];
  p.ingredients.forEach((ing, i) => {
    s.ingredientStock[ing] -= p.amounts[i] * bestBatch;
  });
  s.pizzaStock[best] += bestBatch;
}

// -------------------------------------------------------------------- waiter

/**
 * A waiter works a round: collect orders from every occupied table, make one trip
 * to the kitchen, then deliver to each table in turn. Batching this way is what
 * lets a single waiter keep up with a full room, which the rating economy
 * assumes — the original walked one guest at a time and could never catch up.
 */
function updateWaiter(ctx: SimContext, st: Staff, speed: number): void {
  const { world: w } = ctx;

  const tableSpot = (table: number): { x: number; y: number } => ({
    x: TABLES[table].x,
    y: TABLES[table].y + 11,
  });

  /** Nearest table holding at least one guest in `want`, ignoring `skip`. */
  const nearestTable = (want: 'wait' | 'ordered', skip: number): number => {
    let best = -1;
    let bestDist = Infinity;
    for (let t = 0; t < TABLES.length; t++) {
      if (t === skip) continue;
      if (!w.customers.some((c) => c.table === t && c.state === want)) continue;
      const spot = tableSpot(t);
      const d = Math.hypot(spot.x - st.x, spot.y - st.y);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  };

  const goTo = (table: number, state: Staff['state']): void => {
    st.target = table;
    const spot = tableSpot(table);
    st.tx = spot.x;
    st.ty = spot.y;
    st.state = state;
  };

  if (st.state === 'idle') {
    if (st.carrying) {
      const table = nearestTable('ordered', -1);
      if (table >= 0) {
        goTo(table, 'toServe');
        return;
      }
      st.carrying = false;
    }

    const waiting = nearestTable('wait', -1);
    if (waiting >= 0) {
      goTo(waiting, 'toTable');
      return;
    }
    if (w.customers.some((c) => c.state === 'ordered')) {
      st.tx = 96;
      st.ty = KITCHEN_Y + 14;
      st.state = 'toKitchen';
      return;
    }
    st.tx = 90;
    st.ty = KITCHEN_Y + 20;
    step(st, speed);
    return;
  }

  if (st.state === 'toTable') {
    if (!step(st, speed)) return;
    const table = st.target;
    let took = 0;
    for (const c of w.customers) {
      if (c.table !== table) continue;
      if ((c.state as CustomerState) !== 'wait') continue;
      takeOrder(ctx, c);
      if ((c.state as CustomerState) === 'ordered') took++;
    }
    if (took === 0) {
      // Nothing in the oven for this table — pause instead of looping on it.
      const other = nearestTable('wait', table);
      if (other >= 0) {
        goTo(other, 'toTable');
      } else {
        st.state = 'busy';
        st.timer = 20;
      }
      return;
    }
    const another = nearestTable('wait', table);
    if (another >= 0) goTo(another, 'toTable');
    else st.state = 'idle';
    return;
  }

  if (st.state === 'toKitchen') {
    if (!step(st, speed)) return;
    st.carrying = true;
    st.state = 'idle';
    return;
  }

  if (st.state === 'toServe') {
    if (!step(st, speed)) return;
    const table = st.target;
    for (const c of w.customers) {
      if (c.table === table && (c.state as CustomerState) === 'ordered') serve(ctx, c);
    }
    st.state = 'idle';
  }
}

/** Price acceptance at order time: `180 - 20 * (price/cost)²` (C.java:5386). */
export function pizzaAcceptance(price: number, cost: number): number {
  if (cost <= 0) return 0;
  const k = price / cost;
  return 180 - 20 * k * k;
}

/** Product acceptance is more forgiving: `200 - 20 * (price/cost)²` (C.java:5451). */
export function productAcceptance(price: number, cost: number): number {
  if (cost <= 0) return 0;
  const k = price / cost;
  return 200 - 20 * k * k;
}

/**
 * The original drew a recipe uniformly and made the guest keep waiting when that
 * one happened to be sold out. Here the waiter suggests something that is
 * actually in the oven — with several recipes on the menu that is what a real
 * waiter would do, and it stops a single sold-out line from stalling a table.
 */
function pickAvailable(ctx: SimContext, menu: number[]): number {
  const { state: s, rng } = ctx;
  const inStock = menu.filter((r) => s.pizzaStock[r] > 0);
  const pool = inStock.length > 0 ? inStock : menu;
  return pool[rng.int(0, pool.length - 1)];
}

function takeOrder(ctx: SimContext, c: Customer): void {
  const { state: s, world: w, rng } = ctx;
  const menu = ownedRecipes(s);
  if (menu.length === 0) return;
  const choice = pickAvailable(ctx, menu);
  if (s.pizzaStock[choice] <= 0) {
    c.timer = Math.max(c.timer, 30);
    return;
  }
  const p = pizzaAcceptance(s.pizzaPrice[choice], PIZZAS[choice].cost);
  if (p >= 99 || rng.chance(p)) {
    c.state = 'ordered';
    c.timer = PATIENCE;
    c.bubble = -1;
  } else {
    c.mood = MOOD.tooExpensive;
    leave(c, w);
  }
}

/** The whole basket: one pizza order plus a run of add-on products (C.java:5411). */
function serve(ctx: SimContext, c: Customer): void {
  const { state: s, world: w, rng } = ctx;
  const menu = ownedRecipes(s);
  if (menu.length === 0) return;
  const choice = pickAvailable(ctx, menu);

  if (s.pizzaStock[choice] <= 0) {
    c.mood = MOOD.outOfStock;
    leave(c, w);
    return;
  }

  const scale = scaleOf(s);
  const waiterPower = staffStat(s, 1, 'skill') + staffStat(s, 1, 'speed');

  let qty = scale * rng.int(1, Math.max(1, Math.floor(waiterPower / 2)));
  qty = Math.min(qty, s.pizzaStock[choice]);
  s.pizzaStock[choice] -= qty;
  s.soldToday += qty;
  const pizzaGain = Math.floor((s.netPct * qty * s.pizzaPrice[choice]) / 100);
  s.money += pizzaGain;
  s.profits.pizza += pizzaGain;

  let complete = true;
  let alcohol = false;
  let previous = -1;
  const products = missionOf(s).products;
  while (rng.chance(80)) {
    let n = products[rng.int(0, products.length - 1)];
    if (n === previous) n = products[rng.int(0, products.length - 1)];
    previous = n;

    if (s.productPrice[n] <= 0 || s.productStock[n] <= 0) {
      complete = false;
      break;
    }
    const acc = productAcceptance(s.productPrice[n], PRODUCTS[n].cost);
    if (!rng.chance(acc)) break;

    let q = scale * rng.int(1, Math.max(1, Math.floor(waiterPower / 4)));
    q = Math.min(q, s.productStock[n]);
    s.productStock[n] -= q;
    const gain = Math.floor((s.netPct * q * s.productPrice[n]) / 100);
    s.money += gain;
    s.profits.product += gain;
    if (PRODUCTS[n].alcohol) alcohol = true;
  }

  // Poisoning (C.java:5472).
  const cooks = hiredOf(s, 0);
  const cookSkill = staffStat(s, 0, 'skill');
  const poisonChance = cooks.length > 0 ? 5 - cookSkill / cooks.length : 0;
  if (cooks.length > 0 && rng.chance(poisonChance)) {
    c.mood = MOOD.poisoned;
  } else {
    c.mood = complete ? MOOD.happy : MOOD.poorChoice;
    if (alcohol) {
      const guards = hiredOf(s, 4);
      const guardPower = staffStat(s, 4, 'skill') + staffStat(s, 4, 'speed');
      // Original: the roll only happened when a guard was on duty, so hiring
      // nobody meant no brawls and hiring a weak guard caused them. Here an
      // unguarded room carries a modest base risk that a competent guard removes.
      const brawl = DEVIATIONS.guardsReduceBrawls
        ? guards.length > 0
          ? UNGUARDED_BRAWL_CHANCE - (3 * guardPower) / guards.length
          : UNGUARDED_BRAWL_CHANCE
        : guards.length > 0
          ? 25 - (3 * guardPower) / guards.length
          : 0;
      if (rng.chance(brawl)) c.mood = MOOD.drunk;
    }
  }

  c.state = 'served';
  c.timer = rng.int(40, 100);
  c.bubble = c.mood;
  c.bubbleTimer = 120;
}

// ------------------------------------------------------------------- cleaner

function updateCleaner(ctx: SimContext, st: Staff, speed: number): void {
  const { state: s, rng } = ctx;
  if (st.state === 'idle') {
    if (s.litter.length === 0) {
      st.tx = 60;
      st.ty = 132;
      step(st, speed);
      return;
    }
    const target = s.litter[0];
    st.tx = target.x;
    st.ty = target.y;
    st.state = 'toLitter';
    return;
  }
  if (st.state === 'toLitter' && step(st, speed)) {
    if (s.litter.length > 0) s.litter.shift();
    st.state = 'busy';
    // Cleaning duration falls with the cleaner's own competence.
    const power = st.skill + st.speed;
    st.timer = 15 + rng.int(0, Math.max(4, 60 - 3 * power));
  }
}

function updatePatrol(_ctx: SimContext, st: Staff, speed: number, rng: Rng): void {
  if (step(st, speed)) {
    st.tx = 20 + rng.int(0, ROOM_W - 40);
    st.ty = 118 + rng.int(0, 26);
  }
}

// ------------------------------------------------------------------ delivery

/** Deliveries are run by the drivers (C.java:6872, with the driver/cleaner swap fixed). */
function updateDelivery(ctx: SimContext): void {
  const { state: s, rng } = ctx;
  if (s.tick <= TICK_FIRST_CUSTOMER || s.tick >= TICK_LAST_CUSTOMER) return;

  const type = DEVIATIONS.driversDoDeliveries ? 2 : 3;
  const skill = staffStat(s, type, 'skill');
  const speed = staffStat(s, type, 'speed');
  if (skill <= 0) return;

  if (--s.deliveryTimer > 0) return;
  s.deliveryTimer = Math.max(20, rng.int(100, 200) - Math.floor((10 * speed) / 4));

  const menu = ownedRecipes(s).filter((r) => s.pizzaStock[r] > 0);
  if (menu.length === 0) return;
  const choice = menu[rng.int(0, menu.length - 1)];

  const scale = scaleOf(s);
  let qty = skill < 2 ? 1 : scale * rng.int(1, Math.max(1, Math.floor(skill / 2)));
  qty = Math.min(qty, s.pizzaStock[choice]);
  if (qty <= 0) return;

  s.pizzaStock[choice] -= qty;
  s.soldToday += qty;
  const gain = Math.floor((s.netPct * qty * s.pizzaPrice[choice]) / 100);
  s.money += gain;
  s.profits.delivery += gain;
  spawnCar(ctx, 'delivery');
}

// ----------------------------------------------------------------- day end

function endDay(ctx: SimContext): void {
  const { state: s, world: w, rng } = ctx;

  const ads = dailyAdCost(s);
  if (ads > 0) s.money -= ads;

  s.day++;
  s.tick = 0;
  s.open = false;
  w.customers = [];
  w.walkers = [];
  w.cars = [];
  w.staff = [];
  w.carCooldown = 20;
  w.seats = TABLES.map(() => [false, false, false]);
  s.litter = [];
  s.profits = { pizza: 0, product: 0, machine: 0, delivery: 0 };
  s.soldToday = 0;
  s.moods = new Array(8).fill(0);
  s.deliveryTimer = rng.int(100, 200);

  evaluate(s);
  if (s.ending) return;

  s.dayStartMoney = s.money;
  s.dayStartRating = s.rating;
  log(s, `ДЕНЬ ${s.day + 1}`);
}

/** Win/lose evaluation, run once per day rollover (C.java:2583). */
export function evaluate(s: GameState): void {
  const m = missionOf(s);
  if (m.goalType === 1) {
    if (s.day >= m.days) finish(s, s.rating >= m.goalRating ? 'win' : 'rating');
    else if (s.money < 0) finish(s, 'bankrupt');
    return;
  }
  if (s.money >= m.goalMoney && s.rating >= m.goalRating) finish(s, 'win');
  else if (s.day >= m.days) finish(s, 'time');
  else if (s.money < 0) finish(s, 'bankrupt');
}

function finish(s: GameState, ending: NonNullable<GameState['ending']>): void {
  s.ending = ending;
  s.speed = 0;
}

// -------------------------------------------------------------- UI warnings

/** Which tabs should light up red. Mirrors `var_boolean_arr_f` (C.java:4225). */
export function warnings(s: GameState): boolean[] {
  const flags = new Array(11).fill(false);

  // Prices sitting at cost price.
  flags[1] =
    ownedRecipes(s).some((i) => s.pizzaPrice[i] <= PIZZAS[i].cost) ||
    PRODUCTS.some((p, i) => s.productPrice[i] > 0 && s.productPrice[i] <= p.cost);

  // No recipes bought at all.
  flags[2] = ownedRecipes(s).length === 0;

  // Ingredients missing or not supplied.
  flags[3] = ownedRecipes(s).some((r) =>
    PIZZAS[r].ingredients.some((ing, k) => !s.ingredientSupplied[ing] || s.ingredientStock[ing] < PIZZAS[r].amounts[k]),
  );

  // Products out of stock.
  flags[4] = missionOf(s).products.some((i) => s.productPrice[i] > 0 && s.productStock[i] <= 0);

  // No tables installed.
  flags[8] = !hasTables(s);

  // Missing key staff.
  flags[10] = hiredOf(s, 0).length === 0 || hiredOf(s, 1).length === 0;

  return flags;
}

/** Human-readable reason for a lit warning, used by the pop-up hints. */
export function warningText(index: number): string {
  switch (index) {
    case 1:
      return 'ЦЕНА НА НЕКОТОРЫЕ ТОВАРЫ СТОИТ НА УРОВНЕ СЕБЕСТОИМОСТИ. УВЕЛИЧЬТЕ ЦЕНУ НА НИХ!';
    case 2:
      return 'У ВАС ЕЩЁ НЕТ НИ ОДНОГО ПРИОБРЕТЁННОГО РЕЦЕПТА ПИЦЦЫ';
    case 3:
      return 'КОЛИЧЕСТВА НЕКОТОРЫХ ИНГРЕДИЕНТОВ НЕ ДОСТАТОЧНО ДЛЯ ПРИГОТОВЛЕНИЯ ПИЦЦЫ ИЛИ ВЫ НЕ УСТАНОВИЛИ ПОСТАВКУ ИНГРЕДИЕНТОВ.';
    case 4:
      return 'У ВАС НЕХВАТКА КАКИХ-ЛИБО ТОВАРОВ ИЛИ ВЫ НЕ УСТАНОВИЛИ ПОСТАВКУ ТОВАРОВ.';
    case 8:
      return 'НЕОБХОДИМО УСТАНОВИТЬ СТОЛЫ ДЛЯ ТОГО, ЧТОБЫ КЛИЕНТЫ ЗАХОДИЛИ.';
    case 10:
      return 'ПРИ ОТСУТСТВИИ ПОВАРА ИЛИ ОФИЦИАНТА ПОСЕТИТЕЛИ НЕ ОБСЛУЖИВАЮТСЯ. НАЙМИТЕ РАБОТНИКОВ.';
    default:
      return '';
  }
}

/** Everything the statistics screen needs in one call. */
export function summary(s: GameState) {
  return {
    tax: 100 - s.netPct,
    salary: dailySalary(s),
    ads: dailyAdCost(s),
    scale: scaleOf(s),
    profit: s.profits.pizza + s.profits.product + s.profits.machine + s.profits.delivery,
    moneyDelta: s.money - s.dayStartMoney,
    ratingDelta: s.rating - s.dayStartRating,
  };
}
