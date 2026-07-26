// Font family tokens (Pretendard — already bundled in src/assets/fonts).
// Use these instead of hardcoding 'Pretendard-*' strings: it kills a whole class
// of typo bugs (e.g. 'Pretendard-Semibold' / 'Pretendard-Seimbold' silently fall
// back to the system font because the file is 'Pretendard-SemiBold').
//
// No type scale (sizes / line-heights) is defined yet — the design uses Pretendard
// directly. Add presets here if the design later specifies them.

export const fontFamily = {
  light: 'Pretendard-Light',
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  extrabold: 'Pretendard-ExtraBold',
} as const;

export type FontFamily = typeof fontFamily;
