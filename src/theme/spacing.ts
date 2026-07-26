// Spacing scale on a 4px grid, Tailwind-aligned (step 1 = 4px) so it shares a
// mental model with the primitive color palette (also Tailwind).
// Use for padding / margin / gap. Every value common in the codebase maps exactly:
//   spacing[1]=4  [2]=8  [3]=12  [4]=16  [5]=20  [6]=24  [8]=32  [10]=40
// Half-steps (0.5/1.5/2.5/3.5 → 2/6/10/14) cover the off-grid values already in use.

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export type Spacing = typeof spacing;
