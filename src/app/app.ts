import type { Painter } from '../core/painter';
import { Rng } from '../game/rng';
import type { GameState } from '../game/state';
import { createContext, type SimContext } from '../game/sim';
import type { Input, Key } from '../ui/input';
import { loadRecords, loadSettings, saveSettings, type Records, type Settings } from './profile';
import type { Cue, SoundBank } from './sound';

export interface Screen {
  /** Called once when the screen becomes the active one. */
  enter?(app: App): void;
  exit?(app: App): void;
  /** `dt` is in milliseconds. */
  update?(app: App, dt: number): void;
  draw(app: App, p: Painter): void;
  key?(app: App, key: Key): void;
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
    this.top?.update?.(this, dt);
  }

  draw(p: Painter): void {
    this.top?.draw(this, p);
  }
}
