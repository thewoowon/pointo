// Border-radius scale. The codebase used many ad-hoc values (5,6,8,10,12,14,16,
// 20,24,35…) — this rationalizes them into a t-shirt scale. Snap to the nearest
// step when migrating; `full` is for pills / circles.

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export type Radius = typeof radius;
