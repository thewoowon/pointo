import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';

type ChipProps = {
  label: string;
  value: string;
  /** 이번 차례인 보상. 흰 배경 + 파란 테두리로 앞세운다 */
  active?: boolean;
};

const Chip = ({label, value, active}: ChipProps) => (
  <View style={[s.chip, active ? s.chipActive : s.chipMuted]}>
    <Text style={s.label}>{label}</Text>
    <View style={s.divider} />
    <Text style={[s.value, !active && s.valueMuted]}>{value}</Text>
  </View>
);

type RewardChipsProps = {
  current: string;
  next: string;
};

/**
 * 쿠폰을 2종 이상 번갈아 주는 매장에서만 뜨는 줄.
 * "이번엔 아메리카노, 다음엔 음료" — 판을 채울 이유를 한 줄로 보여준다.
 */
const RewardChips = ({current, next}: RewardChipsProps) => (
  <View style={s.row}>
    <Chip label="이번 보상" value={current} active />
    <Chip label="다음번 보상" value={next} />
  </View>
);

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  chipActive: {
    backgroundColor: p.base.white,
    borderWidth: 1,
    borderColor: p.blue[500],
  },
  chipMuted: {
    backgroundColor: p.slate[100],
    borderWidth: 1,
    borderColor: p.slate[200],
  },
  label: {
    fontSize: 14,
    lineHeight: 24,
    fontFamily: f.semibold,
    color: p.blue[500],
    letterSpacing: -0.3,
  },
  divider: {width: 2, height: 15, backgroundColor: p.slate[200]},
  value: {
    fontSize: 14,
    lineHeight: 24,
    fontFamily: f.medium,
    color: p.gray[700],
    letterSpacing: -0.3,
  },
  valueMuted: {color: p.gray[500]},
});

export default RewardChips;
