import { TABLE_SLOTS, SEATS_PER_TABLE } from '../data/content.ts';

/** Interior view is drawn in its own 158x150 pixel space. */
export const ROOM_W = 158;
export const ROOM_H = 170;

export const DOOR = { x: 79, y: 152 };
export const KITCHEN_Y = 34;
export const OVEN_XS = [112, 126, 140];

/** The original stored tables on a coarse tile grid; these are the pixel centres. */
const TILE_X: Record<number, number> = { 1: 28, 3: 79, 5: 130 };
const TILE_Y: Record<number, number> = { 2: 58, 3: 82, 4: 106 };

export const TABLES = TABLE_SLOTS.map(([tx, ty]) => ({ x: TILE_X[tx], y: TILE_Y[ty], tx, ty }));

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
  anim: number;
}

export interface World {
  customers: Customer[];
  staff: Staff[];
  walkers: Walker[];
  nextId: number;
  /** Vending machine busy timers, one per offered machine. */
  machineBusy: number[];
  /** Which (table, seat) pairs are taken. */
  seats: boolean[][];
  spawnCooldown: number;
}

export function createWorld(): World {
  return {
    customers: [],
    staff: [],
    walkers: [],
    nextId: 1,
    machineBusy: [0, 0, 0, 0, 0],
    seats: TABLES.map(() => new Array(SEATS_PER_TABLE).fill(false)),
    spawnCooldown: 0,
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
