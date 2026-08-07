/** Logical screen size — identical to the 176x208 MIDP canvas of the original game. */
export const SCREEN_W = 176;
export const SCREEN_H = 208;

/** Height of the status strip at the top of every in-game screen. */
export const TOP_BAR_H = 12;
/** Height of the soft-key strip at the bottom of every screen. */
export const BOTTOM_BAR_H = 13;
/** Width of the vertical tab strip on the right-hand side of the gameplay screens. */
export const TAB_STRIP_W = 18;

/** Content rectangle available to a gameplay screen that shows the tab strip. */
export const CONTENT = {
  x: 0,
  y: TOP_BAR_H,
  w: SCREEN_W - TAB_STRIP_W,
  h: SCREEN_H - TOP_BAR_H - BOTTOM_BAR_H,
} as const;

/** Content rectangle for full-width screens (menus, briefings, help). */
export const FULL = {
  x: 0,
  y: TOP_BAR_H,
  w: SCREEN_W,
  h: SCREEN_H - TOP_BAR_H - BOTTOM_BAR_H,
} as const;
