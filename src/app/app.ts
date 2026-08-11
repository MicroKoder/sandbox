import type { Painter } from '../core/painter.ts';
import { Rng } from '../game/rng.ts';
import type { GameState } from '../game/state.ts';
import { createContext, type SimContext } from '../game/sim.ts';
import type { Input, Key } from '../ui/input.ts';
import { loadRecords, loadSettings, saveSettings, type Records, type Settings } from './profile.ts';
import type { Cue, SoundBank } from './sound.ts';

export interface Screen {
  /** Called once when the screen becomes the active one. */
  enter?(app: App): void;
  exit?(app: App): void;
  /** `dt` is in milliseconds. */
  update?(app: App, dt: number): void;
  draw(app: App, p: Painter): void;
  key?(app: App, key: Key): void;
  /** Pointer tap, in logical screen coordinates. */
  click?(app: App, x: number, y: number): void;
  /** Wheel / touch-drag scroll in logical pixels (positive = reveal lower content). */
  onScroll?(app: App, dy: number, x: number, y: number): void;
}

/** A mission in progress: persistent state plus the transient entity world. */
export interface Session extends SimContext {
  state: GameState;
}

export class App {
  readonly input: Input;
  readonly sound: SoundBank;
  settings: Settings;
  records: Records;
  session: Session | null = null;
  rng = new Rng();
  /** Wall-clock milliseconds since the app started, for animation. */
  clock = 0;

  private stack: Screen[] = [];
  private taps: Array<{ x: number; y: number }> = [];
  private scrolls: Array<{ x: number; y: number; dy: number }> = [];

  constructor(input: Input, sound: SoundBank) {
    this.input = input;
    this.sound = sound;
    this.settings = loadSettings();
    this.records = loadRecords();
    this.sound.enabled = this.settings.sound;
  }

  get top(): Screen | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(screen: Screen): void {
    this.stack.push(screen);
    screen.enter?.(this);
  }

  pop(): void {
    const screen = this.stack.pop();
    screen?.exit?.(this);
    this.top?.enter?.(this);
  }

  /** Replaces the whole stack — used when returning to the main menu. */
  reset(screen: Screen): void {
    while (this.stack.length) this.stack.pop()?.exit?.(this);
    this.push(screen);
  }

  replace(screen: Screen): void {
    this.stack.pop()?.exit?.(this);
    this.push(screen);
  }

  beginSession(state: GameState): Session {
    const session = createContext(state, this.rng) as Session;
    this.session = session;
    return session;
  }

  endSession(): void {
    this.session = null;
  }

  persistSettings(): void {
    this.sound.enabled = this.settings.sound;
    saveSettings(this.settings);
  }

  cue(name: Cue): void {
    this.sound.play(name);
  }

  /** Queues a pointer tap in logical screen coordinates. */
  tap(x: number, y: number): void {
    this.taps.push({ x, y });
  }

  /** Queues a scroll gesture in logical pixels. */
  scroll(x: number, y: number, dy: number): void {
    if (dy === 0) return;
    this.scrolls.push({ x, y, dy });
  }

  update(dt: number): void {
    this.clock += dt;
    const screen = this.top;
    if (!screen) return;

    for (const key of this.input.drain()) {
      this.sound.unlock();
      screen.key?.(this, key);
      // A key handler may swap the screen; stop feeding the old one.
      if (this.top !== screen) break;
    }

    const scrolls = this.scrolls;
    this.scrolls = [];
    for (const event of scrolls) {
      const current = this.top;
      if (!current) break;
      current.onScroll?.(this, event.dy, event.x, event.y);
    }

    const taps = this.taps;
    this.taps = [];
    for (const point of taps) {
      const current = this.top;
      if (!current) break;
      this.sound.unlock();
      current.click?.(this, point.x, point.y);
    }

    this.top?.update?.(this, dt);
  }

  draw(p: Painter): void {
    this.top?.draw(this, p);
  }
}
