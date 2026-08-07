/**
 * Colour palette. The original ran on 4096-colour Series 40/60 handsets with a
 * warm brown/orange pizzeria theme; this palette keeps that mood while being a
 * little richer, since we are no longer limited to 12-bit colour.
 */
export const C = {
  // surfaces
  bg: '#1b1410',
  bgAlt: '#241a14',
  panel: '#33241a',
  panelHi: '#46311f',
  panelLo: '#20160f',
  bar: '#2a1d15',

  // lines
  line: '#5c4028',
  lineSoft: '#3c2a1c',

  // ink
  ink: '#f6e7cf',
  inkDim: '#b39a7c',
  inkFaint: '#7d6852',
  inkDark: '#2a1c12',

  // brand
  crust: '#d9a05b',
  cheese: '#ffd15c',

  // accents
  gold: '#ffc84a',
  orange: '#ff9130',
  tomato: '#e0452c',
  basil: '#79b04a',
  sky: '#5cb6e8',
  plum: '#a45cd0',

  // semantics
  good: '#79b04a',
  warn: '#ffc84a',
  bad: '#e0452c',
  money: '#ffc84a',

  // selection
  selBg: '#7a4a18',
  selBgAlt: '#a3651f',
  selInk: '#fff3d6',

  // misc
  black: '#000000',
  white: '#ffffff',
  shadow: 'rgba(0,0,0,0.45)',
} as const;

/** Distinct colours used to identify the player and the nine rival pizzerias. */
export const RIVAL_COLORS = [
  '#5cb6e8', // player (always index 0)
  '#e0452c',
  '#79b04a',
  '#ffc84a',
  '#a45cd0',
  '#e87fb0',
  '#4fc9b0',
  '#f07a35',
  '#8f8f9e',
  '#c2d34a',
] as const;

/** Emotion colours, in the order of the eight visitor moods. */
export const MOOD_COLORS = [
  '#79b04a', // доволен
  '#c2d34a', // ухмылка — слишком дорого
  '#ffc84a', // недоволен — малый выбор
  '#f07a35', // злой — недостаток товара
  '#a45cd0', // плохое поведение — пьяный
  '#7fb37f', // плохо — отравлен
  '#5cb6e8', // напуган — случилось ЧП
  '#e0452c', // недоволен — не обслужили
] as const;
