// Design system entry point.
// Consume via `useTheme()` (see src/contexts/ThemeContext) rather than importing
// these directly in screens — that keeps a single swap point for future modes.
//
// Layers:
//   palette  → primitive colors (Figma: Primitive Colors). Reference only.
//   color    → semantic role tokens (Figma: Semantic Colors). Use these in UI.
//
// Typography is font-family only for now (no bespoke type scale). `font` is
// Pretendard for body/UI; `fontDisplay` is MuseoModerno, scoped to the wordmark
// and the point-mode figure only — see typography.ts.
// Spacing/radius are rationalized scales — see their files.

import {primitives} from './primitives';
import {semanticColors} from './semantic';
import {displayFontFamily, fontFamily} from './typography';
import {spacing} from './spacing';
import {radius} from './radius';

export const theme = {
  color: semanticColors,
  palette: primitives,
  font: fontFamily,
  fontDisplay: displayFontFamily,
  spacing,
  radius,
} as const;

export type Theme = typeof theme;

export {
  primitives,
  semanticColors,
  fontFamily,
  displayFontFamily,
  spacing,
  radius,
};
export type {Primitives} from './primitives';
export type {SemanticColors} from './semantic';
export type {DisplayFontFamily, FontFamily} from './typography';
export type {Spacing} from './spacing';
export type {Radius} from './radius';
