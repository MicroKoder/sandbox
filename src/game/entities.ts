import {
  TABLE_SLOTS,
  FLOOR2_EXTRA_TABLE_SLOTS,
  BASE_TABLE_COUNT,
  SEATS_PER_TABLE,
} from '../data/content.ts';
import { CONTENT } from '../core/screen.ts';

/** Interior / exterior view fills the content pane under the sub-tab strip. */
export const ROOM_W = CONTENT.w;
export const ROOM_H = CONTENT.h - 11;

export const DOOR = { x: Math.floor(ROOM_W / 2), y: ROOM_H - 18 };
export const KITCHEN_Y = 34;
export const OVEN_XS = [ROOM_W - 46, ROOM_W - 32, ROOM_W - 18];
/** Cooks stand behind the counter, in the kitchen band. */
export const COOK_Y = KITCHEN_Y - 5;

/** The original stored tables on a coarse tile grid; these are the pixel centres. */
const TILE_X: Record<number, number> = {
  1: Math.floor(ROOM_W * 0.18),
  3: Math.floor(ROOM_W * 0.5),
  5: Math.floor(ROOM_W * 0.82),
};
const TILE_Y: Record<number, number> = { 2: 58, 3: 82, 4: 106 };

const slotToTable = ([tx, ty]: readonly [number, number]) => ({
  x: TILE_X[tx],
  y: TILE_Y[ty],
  tx,
  ty,
});

/** All table anchors: base five plus the two unlocked by the second floor. */
export const TABLES = [...TABLE_SLOTS, ...FLOOR2_EXTRA_TABLE_SLOTS].map(slotToTable);

/** How many tables are open for seating given the second-floor upgrade. */
export function tableCount(secondFloor: boolean): number {
  return secondFloor ? TABLES.length : BASE_TABLE_COUNT;
}

/** Grow the seat grid when the second floor unlocks more tables. */
export function syncWorldSeats(world: World, secondFloor: boolean): void {
  const n = tableCount(secondFloor);
  while (world.seats.length < n) {
    world.seats.push(new Array(SEATS_PER_TABLE).fill(false));
  }
}

const SEAT_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-13, 3],
  [13, 3],
  [0, -13],
];

export function seatPos(table: number, seat: number): { x: number; y: number } {
  const t = TABLES[table];
  const [dx, dy] = SEAT_OFFSETS[seat % SEATS_PER_TABLE];
  return { x: t.x + dx, y: t.y + dy };
}

/** Vending machines line the left-hand wall. */
export function machinePos(index: number): { x: number; y: number } {
  return { x: 10, y: 44 + index * 20 };
}

// ----------------------------------------------------------------- entities

export type CustomerState = 'enter' | 'wait' | 'ordered' | 'served' | 'machine' | 'leave';

export interface Customer {
  kind: 'customer';
  id: number;
  seed: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: CustomerState;
  timer: number;
  /** Table index, or -1 when the customer went to a vending machine. */
  table: number;
  seat: number;
  machine: number;
  /** Mood index to award on exit, or -1 for none (vending customers). */
  mood: number;
  /** Bubble shown above the head, or -1. */
  bubble: number;
  bubbleTimer: number;
  facing: 1 | -1;
  anim: number;
}

export type StaffState =
  | 'arrive'
  | 'idle'
  | 'toTable'
  | 'toKitchen'
  | 'toServe'
  | 'toLitter'
  | 'toOven'
  | 'busy'
  | 'leave';

export interface Staff {
  kind: 'staff';
  id: number;
  type: number;
  slot: number;
  speed: number;
  skill: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: StaffState;
  timer: number;
  target: number;
  carrying: boolean;
  facing: 1 | -1;
  anim: number;
}

export interface Walker {
  id: number;
  seed: number;
  x: number;
  y: number;
  dir: 1 | -1;
  /** Set once the walker has decided whether to come in. */
  decided: boolean;
  /** Walking from the pavement up to the door before vanishing inside. */
  entering: boolean;
  /** Leaving the pizzeria back onto the street (shows mood bubble). */
  leaving: boolean;
  /** Mood face while leaving; −1 when none. */
  mood: number;
  moodTimer: number;
  anim: number;
}

export type CarKind = 'traffic' | 'delivery';

/** Side-view car driving along the exterior road. */
export interface Car {
  id: number;
  kind: CarKind;
  seed: number;
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
}

export interface World {
  customers: Customer[];
  staff: Staff[];
  walkers: Walker[];
  cars: Car[];
  nextId: number;
  /** Vending machine busy timers, one per offered machine. */
  machineBusy: number[];
  /** Which (table, seat) pairs are taken. */
  seats: boolean[][];
  spawnCooldown: number;
  /** Ticks until the next traffic car may spawn. */
  carCooldown: number;
}

export function createWorld(): World {
  return {
    customers: [],
    staff: [],
    walkers: [],
    cars: [],
    nextId: 1,
    machineBusy: [0, 0, 0, 0, 0],
    seats: Array.from({ length: BASE_TABLE_COUNT }, () => new Array(SEATS_PER_TABLE).fill(false)),
    spawnCooldown: 0,
    carCooldown: 20,
  };
}

/** Moves an entity toward its target; returns true once it has arrived. */
export function step(e: { x: number; y: number; tx: number; ty: number; facing: 1 | -1; anim: number }, speed: number): boolean {
  const dx = e.tx - e.x;
  const dy = e.ty - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= speed) {
    e.x = e.tx;
    e.y = e.ty;
    return true;
  }
  e.x += (dx / dist) * speed;
  e.y += (dy / dist) * speed;
  if (Math.abs(dx) > 0.4) e.facing = dx > 0 ? 1 : -1;
  e.anim += speed;
  return false;
}

/**
 * Picks a free seat, preferring a table that is already partly occupied so the
 * waiter can serve several guests in one round trip.
 */
export function freeSeat(world: World, rngInt: (a: number, b: number) => number): { table: number; seat: number } | null {
  const shared: Array<{ table: number; seat: number }> = [];
  const empty: Array<{ table: number; seat: number }> = [];
  world.seats.forEach((row, t) => {
    const occupied = row.some(Boolean);
    row.forEach((taken, s) => {
      if (taken) return;
      (occupied ? shared : empty).push({ table: t, seat: s });
    });
  });
  const pool = shared.length > 0 ? shared : empty;
  if (pool.length === 0) return null;
  return pool[rngInt(0, pool.length - 1)];
}
