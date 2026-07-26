// Design system entry point.
// Consume via `useTheme()` (see src/contexts/ThemeContext) rather than importing
// these directly in screens — that keeps a single swap point for future modes.
//
// Layers:
//   palette  → primitive colors (Figma: Primitive Colors). Reference only.
//   color    → semantic role tokens (Figma: Semantic Colors). Use these in UI.
//
// Typography is font-family only for now (design uses Pretendard directly, no
// bespoke type scale). Spacing/radius are rationalized scales — see their files.

import {primitives} from './primitives';
import {semanticColors} from './semantic';
import {fontFamily} from './typography';
import {spacing} from './spacing';
import {radius} from './radius';

export const theme = {
  color: semanticColors,
  palette: primitives,
  font: fontFamily,
  spacing,
  radius,
} as const;

export type Theme = typeof theme;

export {primitives, semanticColors, fontFamily, spacing, radius};
export type {Primitives} from './primitives';
export type {SemanticColors} from './semantic';
export type {FontFamily} from './typography';
export type {Spacing} from './spacing';
export type {Radius} from './radius';
