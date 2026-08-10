// Font family tokens (bundled in src/assets/fonts, linked via react-native-asset).
// Use these instead of hardcoding family strings: it kills a whole class of typo
// bugs (e.g. 'Pretendard-Semibold' / 'Pretendard-Seimbold' silently fall back to
// the system font because the file is 'Pretendard-SemiBold').
//
// No type scale (sizes / line-heights) is defined yet — the design uses these
// families directly. Add presets here if the design later specifies them.

// Pretendard — the body/UI face. Default for anything not called out below.
export const fontFamily = {
  light: 'Pretendard-Light',
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
  extrabold: 'Pretendard-ExtraBold',
} as const;

// MuseoModerno — display face, deliberately narrow in scope: the Pointo wordmark
// and the point figure on the point-mode screen. Do not reach for it elsewhere;
// it has no Korean coverage and falls back to the system font on Hangul.
//
// Only the two weights the design actually uses (600/700) are tokenized. The
// other files ship in src/assets/fonts but are intentionally not exposed here.
export const displayFontFamily = {
  semibold: 'MuseoModerno-SemiBold',
  bold: 'MuseoModerno-Bold',
} as const;

export type FontFamily = typeof fontFamily;
export type DisplayFontFamily = typeof displayFontFamily;
