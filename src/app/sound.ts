/**
 * Chiptune replacements for the five AMR clips the original shipped
 * (select / start_mission / mission_completed / lost_mission / upgrade_floor).
 * Everything is synthesised at runtime, so no audio assets are needed.
 */

export type Cue = 'select' | 'start' | 'win' | 'lose' | 'upgrade' | 'cash' | 'deny';

interface Note {
  /** Frequency in Hz; 0 = rest. */
  f: number;
  /** Duration in seconds. */
  d: number;
  type?: OscillatorType;
  gain?: number;
}

const TUNES: Record<Cue, Note[]> = {
  select: [{ f: 880, d: 0.045, type: 'square', gain: 0.1 }],
  deny: [
    { f: 220, d: 0.07, type: 'square', gain: 0.12 },
    { f: 165, d: 0.1, type: 'square', gain: 0.12 },
  ],
  cash: [
    { f: 1046, d: 0.05, type: 'square', gain: 0.09 },
    { f: 1318, d: 0.05, type: 'square', gain: 0.09 },
    { f: 1568, d: 0.09, type: 'square', gain: 0.09 },
  ],
  upgrade: [
    { f: 523, d: 0.07, type: 'triangle', gain: 0.14 },
    { f: 659, d: 0.07, type: 'triangle', gain: 0.14 },
    { f: 784, d: 0.07, type: 'triangle', gain: 0.14 },
    { f: 1046, d: 0.14, type: 'triangle', gain: 0.14 },
  ],
  start: [
    { f: 392, d: 0.1, type: 'square', gain: 0.11 },
    { f: 523, d: 0.1, type: 'square', gain: 0.11 },
    { f: 659, d: 0.1, type: 'square', gain: 0.11 },
    { f: 784, d: 0.2, type: 'square', gain: 0.11 },
  ],
  win: [
    { f: 523, d: 0.11, type: 'square', gain: 0.12 },
    { f: 659, d: 0.11, type: 'square', gain: 0.12 },
    { f: 784, d: 0.11, type: 'square', gain: 0.12 },
    { f: 1046, d: 0.16, type: 'square', gain: 0.12 },
    { f: 784, d: 0.09, type: 'square', gain: 0.1 },
    { f: 1046, d: 0.3, type: 'square', gain: 0.12 },
  ],
  lose: [
    { f: 392, d: 0.14, type: 'sawtooth', gain: 0.1 },
    { f: 330, d: 0.14, type: 'sawtooth', gain: 0.1 },
    { f: 262, d: 0.14, type: 'sawtooth', gain: 0.1 },
    { f: 196, d: 0.34, type: 'sawtooth', gain: 0.1 },
  ],
};

export class SoundBank {
  enabled = true;
  private ctx: AudioContext | null = null;

  private context(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Browsers require a gesture before audio starts; call this on first input. */
  unlock(): void {
    this.context();
  }

  play(cue: Cue): void {
    if (!this.enabled) return;
    const ctx = this.context();
    if (!ctx) return;

    let t = ctx.currentTime;
    for (const note of TUNES[cue]) {
      if (note.f > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = note.type ?? 'square';
        osc.frequency.setValueAtTime(note.f, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(note.gain ?? 0.1, t + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + note.d);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + note.d + 0.02);
      }
      t += note.d;
    }
  }
}
