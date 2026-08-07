/** Logical buttons, modelled on the original's MIDP keypad. */
export type Key =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'back'
  | 'soft1'
  | 'menu'
  | 'speedDown'
  | 'speedUp'
  | 'hint'
  | 'buySmall'
  | 'buyBig'
  | 'sellSmall'
  | 'sellBig'
  | 'prevTab'
  | 'nextTab';

/**
 * Keyboard mapping. The number-pad shortcuts of the original (4/6 small
 * sell/buy, 7/9 big sell/buy, * and # for speed, 0 for the hint) are kept on the
 * digit row so the muscle memory still works, with arrow keys layered on top.
 */
const MAP: Record<string, Key> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Numpad2: 'down',
  Numpad8: 'up',
  Enter: 'select',
  NumpadEnter: 'select',
  Space: 'select',
  Digit5: 'select',
  Numpad5: 'select',
  Escape: 'back',
  Backspace: 'back',
  Tab: 'soft1',
  KeyM: 'menu',
  Minus: 'speedDown',
  NumpadSubtract: 'speedDown',
  Equal: 'speedUp',
  NumpadAdd: 'speedUp',
  KeyH: 'hint',
  Digit0: 'hint',
  Digit4: 'sellSmall',
  Digit6: 'buySmall',
  Digit7: 'sellBig',
  Digit9: 'buyBig',
  Numpad4: 'sellSmall',
  Numpad6: 'buySmall',
  Numpad7: 'sellBig',
  Numpad9: 'buyBig',
  KeyQ: 'prevTab',
  KeyE: 'nextTab',
  BracketLeft: 'prevTab',
  BracketRight: 'nextTab',
  PageUp: 'prevTab',
  PageDown: 'nextTab',
};

const REPEATABLE = new Set<Key>(['up', 'down', 'left', 'right', 'buySmall', 'buyBig', 'sellSmall', 'sellBig']);

const REPEAT_DELAY = 380;
const REPEAT_RATE = 70;

export interface TextInputTarget {
  onText(ch: string): void;
  onBackspace(): void;
}

/**
 * Collects key presses into a per-frame queue so that screens can drain them in
 * their update step rather than reacting inside DOM handlers.
 */
export class Input {
  private queue: Key[] = [];
  private held = new Map<Key, { at: number; next: number }>();
  private raw = new Set<string>();
  textTarget: TextInputTarget | null = null;

  private onDown = (ev: KeyboardEvent): void => {
    if (this.textTarget) {
      if (ev.code === 'Backspace') {
        ev.preventDefault();
        this.textTarget.onBackspace();
        return;
      }
      if (ev.key.length === 1) {
        ev.preventDefault();
        this.textTarget.onText(ev.key);
        return;
      }
    }

    const key = MAP[ev.code];
    if (!key) return;
    ev.preventDefault();
    if (this.raw.has(ev.code)) return;
    this.raw.add(ev.code);
    this.queue.push(key);
    if (REPEATABLE.has(key)) {
      this.held.set(key, { at: performance.now(), next: performance.now() + REPEAT_DELAY });
    }
  };

  private onUp = (ev: KeyboardEvent): void => {
    const key = MAP[ev.code];
    this.raw.delete(ev.code);
    if (key) this.held.delete(key);
  };

  private onBlur = (): void => {
    this.raw.clear();
    this.held.clear();
  };

  attach(target: Window | HTMLElement = window): void {
    target.addEventListener('keydown', this.onDown as EventListener);
    target.addEventListener('keyup', this.onUp as EventListener);
    window.addEventListener('blur', this.onBlur);
  }

  detach(target: Window | HTMLElement = window): void {
    target.removeEventListener('keydown', this.onDown as EventListener);
    target.removeEventListener('keyup', this.onUp as EventListener);
    window.removeEventListener('blur', this.onBlur);
  }

  /** Adds a synthetic press — used by the on-screen touch controls. */
  press(key: Key): void {
    this.queue.push(key);
  }

  /** Returns and clears the presses collected since the previous frame. */
  drain(): Key[] {
    const now = performance.now();
    for (const [key, state] of this.held) {
      while (now >= state.next) {
        this.queue.push(key);
        state.next += REPEAT_RATE;
      }
    }
    const out = this.queue;
    this.queue = [];
    return out;
  }
}
