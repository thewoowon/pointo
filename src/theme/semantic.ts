// AUTO-GENERATED from `semantic colors.json` (Figma: Semantic Colors)
// Semantic role tokens that reference primitives. Regenerate from Figma export.

import {primitives as p} from './primitives';

export const semanticColors = {
  surface: {
    normal: {
      bg1: '#FFFFFF',
      container0: p.base.white,
      container10: p.slate[100],
      none: 'transparent',
    },
    brand: {
      primary: p.blue[500],
    },
    env: {
      success: p.green[500],
      warning: p.red[500],
      disabled: p.slate[200],
    },
  },
  texticon: {
    onNormal: {
      highestemp: p.base.black,
      highemp: p.gray[700],
      midemp: p.gray[500],
      lowemp: p.gray[400],
      lowestemp: p.gray[300],
      primary: p.blue[500],
      success: p.green[500],
      warning: p.red[600],
    },
    onBrand: {
      onPrimary: p.base.white,
    },
    onEnv: {
      onEnviroment: p.base.white,
      onDisabled: p.slate[400],
    },
  },
  border: {
    normal: {
      highemp: '#FFFFFF',
      midemp: '#FFFFFF',
      lowemp: '#FFFFFF',
    },
    brand: {
      primary: p.blue[500],
    },
    env: {
      warning: p.red[500],
    },
  },
  etc: {
    absolute: {
      black: '#000000',
      white: '#FFFFFF',
    },
  },
} as const;

export type SemanticColors = typeof semanticColors;
