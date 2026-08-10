import {StyleSheet} from 'react-native';
import {
  semanticColors as c,
  primitives as p,
  fontFamily as f,
} from '../../../theme';

/** 파란 hero 카드의 공통 골격. 포인트/스탬프 카드가 같은 상자를 쓴다. */
export const heroStyles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: c.surface.brand.primary,
    paddingHorizontal: 28,
    paddingVertical: 26,
    // overflow: 'hidden' 금지 — iOS에서 masksToBounds가 그림자까지 잘라낸다.
    // 카드 밖으로 삐져나가는 자식이 없으므로 클리핑도 필요 없다.
    shadowColor: p.gray[900],
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: f.medium,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: -0.3,
  },
  title: {
    marginTop: 4,
    fontSize: 20,
    fontFamily: f.bold,
    color: p.base.white,
    letterSpacing: -0.6,
  },
});

/**
 * 한글 조사 자동 선택. '총 5,044원이 있습니다' / '총 5,044P가 있습니다' —
 * pointUnit은 매장이 정하는 값이라 받침 유무를 미리 알 수 없다.
 */
export const subjectParticle = (word: string): string => {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 === 0 ? '가' : '이';
  }
  return '가';
};
