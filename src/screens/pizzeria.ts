import { C, MOOD_COLORS } from '../core/palette.ts';
import type { Painter } from '../core/painter.ts';
import { getMoodIcons } from '../art/icons.ts';
import { deliveryVanSprite, trafficCarSprite } from '../art/cars.ts';
import { drawPerson, visitorLook, STAFF_LOOKS, type Pose } from '../art/people.ts';
import { ctxOf, makeCanvas } from '../art/pixel.ts';
import { DOOR, KITCHEN_Y, OVEN_XS, ROOM_H, ROOM_W, TABLES, machinePos, type Car } from '../game/entities.ts';
import type { World } from '../game/entities.ts';
import {
  TICKS_PER_HOUR,
  installedMachines,
  type GameState,
} from '../game/state.ts';
import { UPGRADE_SECOND_FLOOR, UPGRADE_TABLES } from '../data/content.ts';

/**
 * The two "ПИЦЦЕРИЯ" sub-views. Both are drawn straight into the shared pixel
 * buffer, offset so the room fills the content pane under the status bar.
 */

const personCache = new Map<string, HTMLCanvasElement>();

function personCanvas(key: string, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = personCache.get(key);
  if (hit) return hit;
  const canvas = makeCanvas(9, 19);
  draw(ctxOf(canvas));
  personCache.set(key, canvas);
  return canvas;
}

function poseOf(anim: number, moving: boolean): Pose {
  if (!moving) return 'stand';
  return Math.floor(anim / 4) % 2 === 0 ? 'walk1' : 'walk2';
}

function drawVisitor(p: Painter, seed: number, x: number, y: number, pose: Pose, facing: 1 | -1): void {
  const look = visitorLook(seed);
  const canvas = personCanvas(`v${seed % 512}-${pose}`, (ctx) => drawPerson(ctx, look, pose));
  if (facing < 0) p.blitFlipped(canvas, Math.round(x) - 4, Math.round(y) - 17, 9);
  else p.blit(canvas, Math.round(x) - 4, Math.round(y) - 17);
}

function drawStaffMember(p: Painter, type: number, x: number, y: number, pose: Pose, facing: 1 | -1): void {
  const look = STAFF_LOOKS[type] ?? STAFF_LOOKS[0];
  const canvas = personCanvas(`s${type}-${pose}`, (ctx) => drawPerson(ctx, look, pose));
  if (facing < 0) p.blitFlipped(canvas, Math.round(x) - 4, Math.round(y) - 17, 9);
  else p.blit(canvas, Math.round(x) - 4, Math.round(y) - 17);
}

/** Speech bubble with a mood face, drawn above a customer's head. */
function drawBubble(p: Painter, mood: number, x: number, y: number): void {
  const icons = getMoodIcons();
  const icon = icons[mood];
  if (!icon) return;
  const bx = Math.round(x) - 6;
  const by = Math.round(y) - 32;
  p.box(bx, by, 13, 13, '#f4ead6', C.inkDark);
  p.px(bx + 6, by + 13, C.inkDark);
  p.px(bx + 5, by + 13, '#f4ead6');
  p.blit(icon, bx + 2, by + 2);
  p.px(bx + 1, by + 1, MOOD_COLORS[mood] ?? C.gold);
}

// ---------------------------------------------------------------- interior

export function drawInterior(p: Painter, s: GameState, w: World, oy: number): void {
  const x0 = 0;

  // Floor — cooler stone tiles so warm furniture and people read against it.
  p.fill(x0, oy, ROOM_W, ROOM_H, '#3e3832');
  for (let ty = 0; ty < ROOM_H; ty += 8) {
    for (let tx = 0; tx < ROOM_W; tx += 8) {
      const alt = ((tx / 8 + ty / 8) | 0) % 2 === 0;
      p.fill(x0 + tx, oy + ty, 8, 8, alt ? '#6a6256' : '#4a443c');
    }
  }

  // Back wall and kitchen band.
  p.gradientV(x0, oy, ROOM_W, KITCHEN_Y, '#6b4a30', '#573b26');
  p.hLine(x0, oy + KITCHEN_Y, ROOM_W, '#33241a');

  // Wall decorations: menu board and a window.
  p.box(x0 + 8, oy + 6, 40, 20, '#2f2018', '#8a6a44');
  p.text('МЕНЮ', x0 + 28, oy + 9, C.gold, 'center');
  for (let i = 0; i < 3; i++) p.hLine(x0 + 12, oy + 17 + i * 3, 32, '#5c4530');

  p.box(x0 + 56, oy + 4, 30, 22, '#7fb0d8', '#4a3524');
  p.fill(x0 + 58, oy + 6, 26, 8, '#a7cfe8');
  p.vLine(x0 + 71, oy + 5, 20, '#4a3524');

  // Ovens.
  for (const ox of OVEN_XS) {
    p.box(x0 + ox - 7, oy + 8, 14, 20, '#3a2a1e', '#8a6a44');
    p.fill(x0 + ox - 4, oy + 12, 8, 8, '#d1611f');
    p.fill(x0 + ox - 3, oy + 14, 6, 5, '#ffb43c');
    p.hLine(x0 + ox - 5, oy + 24, 10, '#8a6a44');
  }

  // Counter — stretches across the kitchen side of the wider room.
  const counterX = Math.floor(ROOM_W * 0.55);
  const counterW = ROOM_W - counterX - 6;
  p.fill(x0 + counterX, oy + KITCHEN_Y - 6, counterW, 6, '#8a6034');
  p.hLine(x0 + counterX, oy + KITCHEN_Y - 6, counterW, '#b8834a');

  // Vending machines.
  for (const m of installedMachines(s)) {
    const pos = machinePos(m);
    drawMachine(p, x0 + pos.x - 6, oy + pos.y - 14, m);
  }

  // Plants and bins, when installed.
  if (s.upgrades[4]) {
    drawPlant(p, x0 + ROOM_W - 8, oy + 46);
    drawPlant(p, x0 + ROOM_W - 8, oy + 118);
  }
  if (s.upgrades[3]) drawBin(p, x0 + 6, oy + 134);

  // Tables.
  if (s.upgrades[UPGRADE_TABLES]) {
    for (const t of TABLES) drawTable(p, x0 + t.x, oy + t.y);
  } else {
    p.text('НЕТ СТОЛОВ', x0 + ROOM_W / 2, oy + 74, C.tomato, 'center');
  }

  // Litter.
  for (const item of s.litter) {
    drawLitter(p, x0 + item.x, oy + item.y, item.kind);
  }

  // Door, set into the near wall at the bottom of the room.
  p.fill(x0, oy + ROOM_H - 14, ROOM_W, 14, '#3a2a1e');
  p.hLine(x0, oy + ROOM_H - 14, ROOM_W, '#5c4530');
  p.box(x0 + DOOR.x - 14, oy + ROOM_H - 13, 28, 12, '#2f2018', '#8a6a44');
  p.text(s.open ? 'ОТКРЫТО' : 'ЗАКРЫТО', x0 + DOOR.x, oy + ROOM_H - 10, s.open ? C.basil : C.inkFaint, 'center');

  // People, painter's-algorithm sorted by feet position.
  const drawables: Array<{ y: number; draw: () => void }> = [];

  for (const c of w.customers) {
    drawables.push({
      y: c.y,
      draw: () => {
        const moving = c.state === 'enter' || c.state === 'leave';
        const pose: Pose = c.state === 'wait' || c.state === 'ordered' || c.state === 'served' ? 'sit' : poseOf(c.anim, moving);
        drawVisitor(p, c.seed, x0 + c.x, oy + c.y, pose, c.facing);
        if (c.bubbleTimer > 0 && c.bubble >= 0) drawBubble(p, c.bubble, x0 + c.x, oy + c.y);
        else if (c.state === 'wait') drawWaitMark(p, x0 + c.x, oy + c.y);
      },
    });
  }

  for (const st of w.staff) {
    drawables.push({
      y: st.y,
      draw: () => {
        const moving = st.state !== 'busy' && st.state !== 'idle';
        drawStaffMember(p, st.type, x0 + st.x, oy + st.y, poseOf(st.anim, moving), st.facing);
        if (st.carrying) {
          p.fill(x0 + Math.round(st.x) + (st.facing > 0 ? 4 : -6), oy + Math.round(st.y) - 12, 4, 3, C.cheese);
        }
      },
    });
  }

  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();
}

function drawTable(p: Painter, x: number, y: number): void {
  p.fill(x - 9, y - 3, 18, 8, '#7a5230');
  p.fill(x - 9, y - 4, 18, 2, '#a06c3d');
  p.fill(x - 2, y + 5, 4, 4, '#5c3d22');
  p.fill(x - 5, y + 9, 10, 2, '#4a3018');
  // Two stools.
  p.fill(x - 14, y + 2, 4, 3, '#5c3d22');
  p.fill(x + 10, y + 2, 4, 3, '#5c3d22');
}

function drawMachine(p: Painter, x: number, y: number, index: number): void {
  const tints = ['#8a5a2c', '#3f8ec4', '#a83a3a', '#4a8a5a', '#a45cd0', '#c98a2c'];
  p.box(x, y, 12, 22, tints[index % tints.length], '#1a120c');
  p.fill(x + 2, y + 2, 8, 7, '#d8e4ea');
  p.fill(x + 2, y + 11, 3, 3, C.gold);
  p.fill(x + 7, y + 11, 3, 3, C.gold);
  p.fill(x + 2, y + 17, 8, 3, '#1a120c');
}

function drawPlant(p: Painter, x: number, y: number): void {
  p.fill(x - 3, y, 6, 5, '#8a5230');
  p.fill(x - 4, y - 2, 8, 2, '#a06c3d');
  p.fill(x - 1, y - 8, 2, 7, '#4c7a34');
  p.fill(x - 5, y - 10, 4, 3, '#6aa044');
  p.fill(x + 1, y - 12, 4, 3, '#6aa044');
  p.fill(x - 3, y - 13, 5, 3, '#79b04a');
}

function drawBin(p: Painter, x: number, y: number): void {
  p.box(x, y, 8, 10, '#5a6060', '#2a2e2e');
  p.hLine(x - 1, y - 1, 10, '#79807f');
}

function drawLitter(p: Painter, x: number, y: number, kind: number): void {
  const colors = ['#c9c0aa', '#9aa04a', '#c47a4a', '#8a8f9a'];
  const color = colors[kind % colors.length];
  p.px(x, y, color);
  p.px(x + 1, y, color);
  p.px(x, y + 1, color);
  if (kind % 2 === 0) p.px(x + 2, y + 1, color);
}

function drawWaitMark(p: Painter, x: number, y: number): void {
  p.text('?', Math.round(x) + 5, Math.round(y) - 26, C.gold);
}

function drawCar(p: Painter, car: Car, oy: number): void {
  const sprite = car.kind === 'delivery' ? deliveryVanSprite() : trafficCarSprite(car.seed);
  const w = sprite.width;
  const h = sprite.height;
  const x = Math.round(car.x) - Math.floor(w / 2);
  const y = oy + Math.round(car.y) - h;
  if (car.dir < 0) p.blitFlipped(sprite, x, y, w);
  else p.blit(sprite, x, y);
  // Soft shadow under the wheels.
  p.fill(x + 2, oy + Math.round(car.y) - 1, w - 4, 1, 'rgba(0,0,0,0.35)');
}

// ---------------------------------------------------------------- exterior

export function drawExterior(p: Painter, s: GameState, w: World, oy: number): void {
  const hour = s.tick / TICKS_PER_HOUR;
  const night = hour < 6 || hour >= 21;
  const dusk = (hour >= 19 && hour < 21) || (hour >= 5 && hour < 7);

  const skyTop = night ? '#141a2e' : dusk ? '#5b3a4a' : '#4f86b8';
  const skyBottom = night ? '#242c40' : dusk ? '#c4703c' : '#9fc6e0';
  p.gradientV(0, oy, ROOM_W, 78, skyTop, skyBottom);

  // Sun or moon.
  if (!night) {
    const t = Math.max(0, Math.min(1, (hour - 6) / 15));
    const sx = Math.round(14 + t * (ROOM_W - 28));
    const sy = Math.round(58 - Math.sin(t * Math.PI) * 42);
    p.fill(sx - 3, sy - 3, 7, 7, dusk ? '#ffb04a' : '#ffe9a8');
    p.fill(sx - 4, sy - 2, 9, 5, dusk ? '#ffb04a' : '#ffe9a8');
    p.fill(sx - 2, sy - 4, 5, 9, dusk ? '#ffb04a' : '#ffe9a8');
  } else {
    p.fill(ROOM_W - 34, oy + 14, 7, 7, '#e8ecf4');
    p.fill(ROOM_W - 36, oy + 16, 4, 3, skyTop);
    for (let i = 0; i < 12; i++) {
      const sx = (i * 53) % ROOM_W;
      const sy = oy + ((i * 29) % 50);
      p.px(sx, sy, '#c9d4e8');
    }
  }

  // Neighbouring rooftops.
  p.fill(0, oy + 62, ROOM_W, 18, night ? '#1c2233' : '#6b6f80');
  for (let i = 0; i < 6; i++) {
    const bx = i * 28;
    const bh = 10 + ((i * 7) % 12);
    p.fill(bx, oy + 74 - bh, 24, bh, night ? '#232a3d' : '#7b7f90');
    for (let wy = 0; wy < bh - 4; wy += 5) {
      for (let wx = 0; wx < 20; wx += 6) {
        const lit = night && (i + wx + wy) % 3 === 0;
        p.fill(bx + 2 + wx, oy + 76 - bh + wy, 3, 3, lit ? '#ffd97a' : night ? '#161c2b' : '#5d6172');
      }
    }
  }

  // Our pizzeria — centred on the wider street facade.
  const bw = 140;
  const bx = Math.floor((ROOM_W - bw) / 2);
  const hasFloor2 = s.upgrades[UPGRADE_SECOND_FLOOR];
  const top = hasFloor2 ? 18 : 44;

  p.fill(bx, oy + top, bw, 96 - top + 16, '#b8763c');
  p.hLine(bx, oy + top, bw, '#d99a58');
  p.vLine(bx, oy + top, 112 - top, '#d99a58');
  p.vLine(bx + bw - 1, oy + top, 112 - top, '#8a5228');

  // Roof.
  p.fill(bx - 3, oy + top - 4, bw + 6, 4, '#7a4a24');
  p.fill(bx - 1, oy + top - 6, bw + 2, 2, '#96602f');

  if (hasFloor2) {
    for (let i = 0; i < 4; i++) {
      const wx = bx + 12 + i * 30;
      p.box(wx, oy + top + 8, 20, 16, night ? '#ffd97a' : '#8fc0dc', '#5c3a1c');
      p.vLine(wx + 10, oy + top + 9, 14, '#5c3a1c');
    }
    p.hLine(bx, oy + 44, bw, '#8a5228');
  }

  // Sign.
  p.box(bx + 16, oy + 48, bw - 32, 12, '#2f1d12', C.gold);
  p.text('ПИЦЦЕРИЯ', bx + bw / 2, oy + 51, s.open ? C.gold : C.inkFaint, 'center');

  // Awning.
  for (let i = 0; i < bw - 8; i += 8) {
    p.fill(bx + 4 + i, oy + 62, 4, 7, C.tomato);
    p.fill(bx + 8 + i, oy + 62, 4, 7, '#f4ead6');
  }
  p.hLine(bx + 4, oy + 62, bw - 8, '#8a2a1c');

  // Windows and door.
  p.box(bx + 10, oy + 72, 32, 24, night ? '#3a2a1e' : '#8fc0dc', '#5c3a1c');
  p.box(bx + bw - 42, oy + 72, 32, 24, night ? '#3a2a1e' : '#8fc0dc', '#5c3a1c');
  if (s.open) {
    p.fill(bx + 12, oy + 74, 28, 20, '#ffd97a');
    p.fill(bx + bw - 40, oy + 74, 28, 20, '#ffd97a');
  }
  p.box(bx + bw / 2 - 10, oy + 74, 20, 22, '#4a2f1a', '#7a4a24');
  p.px(bx + bw / 2 + 5, oy + 86, C.gold);

  // Optional exterior upgrades.
  if (s.upgrades[2]) {
    p.vLine(bx + 2, oy + top, 96 - top, '#8a8f9a');
    p.vLine(bx + bw - 3, oy + top, 96 - top, '#8a8f9a');
  }
  if (s.upgrades[5]) {
    p.box(6, oy + 58, 22, 26, '#2f2018', C.gold);
    p.text('ПИЦ', 17, oy + 64, C.gold, 'center');
    p.text('ЦА', 17, oy + 72, C.gold, 'center');
    p.fill(15, oy + 84, 4, 12, '#5a5f66');
  }
  if (s.upgrades[3]) drawBin(p, ROOM_W - 18, oy + 100);
  if (s.upgrades[4]) {
    drawPlant(p, bx - 8, oy + 104);
    drawPlant(p, bx + bw + 8, oy + 104);
  }

  // Pavement (people) and two-lane road (cars).
  p.fill(0, oy + 96, ROOM_W, 22, '#8a8477');
  p.hLine(0, oy + 96, ROOM_W, '#a29b8c');
  for (let x = 0; x < ROOM_W; x += 12) p.vLine(x, oy + 96, 22, '#7a7568');
  p.fill(0, oy + 118, ROOM_W, ROOM_H - 118, '#3d3a36');
  // Kerbs.
  p.hLine(0, oy + 118, ROOM_W, '#a29b8c');
  p.hLine(0, oy + 119, ROOM_W, '#5a564e');
  // Centre divider: above → left, below → right.
  const midY = oy + 144;
  for (let x = 2; x < ROOM_W; x += 10) p.fill(x, midY, 6, 2, '#c9c0aa');
  // Edge dashes on each lane.
  for (let x = 4; x < ROOM_W; x += 16) {
    p.fill(x, oy + 126, 7, 1, '#7a7568');
    p.fill(x, oy + 160, 7, 1, '#7a7568');
  }

  // Pedestrians on the pavement; sort by feet so those walking up to the door
  // sit correctly in depth as they approach the facade.
  const walkers = [...w.walkers].sort((a, b) => a.y - b.y);
  for (const walker of walkers) {
    drawVisitor(p, walker.seed, walker.x, oy + walker.y, poseOf(walker.anim, true), walker.dir);
  }

  // Cars: top lane leftbound, bottom lane rightbound.
  const cars = [...w.cars].sort((a, b) => a.y - b.y);
  for (const car of cars) drawCar(p, car, oy);

  if (night) {
    p.setAlpha(0.28);
    p.fill(0, oy, ROOM_W, ROOM_H, '#0a1024');
    p.setAlpha(1);
  }
}
