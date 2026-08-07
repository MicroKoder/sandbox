/**
 * Small deterministic RNG. `int(a, b)` reproduces the original's `int_b(a, b)`:
 * an inclusive range that degenerates to `a` whenever `a >= b`.
 */
export class Rng {
  private s: number;

  constructor(seed = Date.now() >>> 0) {
    this.s = (seed || 1) >>> 0;
  }

  next(): number {
    // xorshift32
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0x100000000;
  }

  /** Inclusive integer in [a, b]; returns `a` when `a >= b`, like the original. */
  int(a: number, b: number): number {
    if (a >= b) return a;
    return a + Math.floor(this.next() * (b - a + 1));
  }

  /** `true` with probability `percent`/100 — mirrors `rand(1,100) <= p`. */
  chance(percent: number): boolean {
    if (percent <= 0) return false;
    if (percent >= 100) return true;
    return this.int(1, 100) <= percent;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }
}

export const rng = new Rng();
