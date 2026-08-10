import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {fontFamily as f} from '../../../theme';
import {heroStyles as h} from './heroStyles';
import StampGrid from './StampGrid';

type StampHeroCardProps = {
  capacity: number;
  filled: number;
  expanded: boolean;
};

const StampHeroCard = ({capacity, filled, expanded}: StampHeroCardProps) => {
  const remaining = capacity - filled;
  // 판이 비었거나 꽉 찼을 땐 재촉하지 않는다 — 각각 시작 전이고, 이미 도착했다.
  const showNudge = filled > 0 && remaining > 0;

  return (
    <View style={[h.card, {minHeight: expanded ? 300 : 260}]}>
      <Text style={h.label}>스탬프 현황</Text>
      <Text style={h.title}>총 {filled}개의 스탬프가 있습니다</Text>

      <View style={s.gridArea}>
        <StampGrid capacity={capacity} filled={filled} />
      </View>

      {showNudge && (
        <Text style={s.nudge}>무료쿠폰까지 {remaining}개만 더!</Text>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  gridArea: {flex: 1, justifyContent: 'center', paddingVertical: 20},
  nudge: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: f.semibold,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.3,
  },
});

export default StampHeroCard;
