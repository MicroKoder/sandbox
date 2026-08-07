import { MISSION_COUNT } from '../data/missions.ts';
import type { Difficulty, GameState } from '../game/state.ts';

const SETTINGS_KEY = 'pizza-magnate/settings';
const RECORDS_KEY = 'pizza-magnate/records';
const SAVE_KEY = 'pizza-magnate/save';

export interface Settings {
  playerName: string;
  difficulty: Difficulty;
  sound: boolean;
  hints: boolean;
}

export interface MissionRecord {
  /** `null` = locked, otherwise the best result so far (`days === 0` = unlocked, unfinished). */
  days: number;
  money: number;
  name: string;
}

export interface Records {
  missions: Array<MissionRecord | null>;
}

const DEFAULT_SETTINGS: Settings = {
  playerName: 'ИГРОК',
  difficulty: 1,
  sound: true,
  hints: true,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — the game still runs, just without persistence */
  }
}

export function loadSettings(): Settings {
  return read(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}

export function loadRecords(): Records {
  const empty: Records = {
    missions: Array.from({ length: MISSION_COUNT }, (_, i) => (i === 0 ? { days: 0, money: 0, name: '' } : null)),
  };
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Records;
    if (!Array.isArray(parsed.missions) || parsed.missions.length !== MISSION_COUNT) return empty;
    return parsed;
  } catch {
    return empty;
  }
}

export function saveRecords(r: Records): void {
  write(RECORDS_KEY, r);
}

/** Marks a mission as beaten and unlocks the next one. */
export function recordWin(r: Records, mission: number, days: number, money: number, name: string): Records {
  const missions = [...r.missions];
  const prev = missions[mission];
  if (!prev || prev.days === 0 || days < prev.days || (days === prev.days && money > prev.money)) {
    missions[mission] = { days, money, name };
  }
  if (mission + 1 < MISSION_COUNT && !missions[mission + 1]) {
    missions[mission + 1] = { days: 0, money: 0, name: '' };
  }
  const next = { missions };
  saveRecords(next);
  return next;
}

export const isUnlocked = (r: Records, mission: number): boolean => r.missions[mission] !== null;

// ------------------------------------------------------------------- saves

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function writeSave(state: GameState): void {
  write(SAVE_KEY, state);
}

export function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
