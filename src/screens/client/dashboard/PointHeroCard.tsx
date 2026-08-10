import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  primitives as p,
  fontFamily as f,
  displayFontFamily as df,
} from '../../../theme';
import {heroStyles as h, subjectParticle} from './heroStyles';

type PointHeroCardProps = {
  points: number;
  unit: string;
  /** 이번 세션에서 적립된 양. 0이면 델타 줄을 숨긴다 */
  delta: number;
  expanded: boolean;
};

/**
 * 포인트 모드 hero. 좌상단에 문장, 우하단에 큰 수치.
 * 수치만 MuseoModerno — 단위 글자는 Pretendard로 둔다 (한글 글리프가 없어서
 * '원' 같은 단위를 넘기면 시스템 폰트로 튄다).
 */
const PointHeroCard = ({points, unit, delta, expanded}: PointHeroCardProps) => {
  const amount = points.toLocaleString();

  return (
    <View style={[h.card, {minHeight: expanded ? 300 : 240}]}>
      <Text style={h.label}>포인트 현황</Text>
      <Text style={h.title}>
        총 {amount}
        {unit}
        {subjectParticle(unit)} 있습니다
      </Text>

      <View style={s.figureArea}>
        {delta > 0 && (
          <View style={s.deltaRow}>
            <Text
              style={[s.delta, {fontSize: expanded ? 30 : 24}]}
              numberOfLines={1}>
              +{delta.toLocaleString()}
            </Text>
            <Text style={[s.deltaUnit, {fontSize: expanded ? 17 : 14}]}>
              {unit}
            </Text>
          </View>
        )}
        <View style={s.figureRow}>
          <Text
            style={[
              s.figure,
              {fontSize: expanded ? 56 : 44, lineHeight: expanded ? 64 : 52},
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {amount}
          </Text>
          <Text style={[s.figureUnit, {fontSize: expanded ? 28 : 22}]}>
            {unit}
          </Text>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  figureArea: {flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end'},
  deltaRow: {flexDirection: 'row', alignItems: 'baseline', gap: 6},
  delta: {
    fontFamily: df.semibold,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: -1,
  },
  deltaUnit: {fontFamily: f.medium, color: 'rgba(255,255,255,0.5)'},
  figureRow: {flexDirection: 'row', alignItems: 'baseline', gap: 8},
  figure: {
    fontFamily: df.semibold,
    color: p.base.white,
    letterSpacing: -1.5,
  },
  figureUnit: {fontFamily: f.semibold, color: p.base.white},
});

export default PointHeroCard;
