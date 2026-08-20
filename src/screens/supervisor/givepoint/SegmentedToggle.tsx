import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';
import type {GiveMode} from '../useGivePoint';

type SegmentedToggleProps = {
  mode: GiveMode;
  onChange: (mode: GiveMode) => void;
};

/** 적립하기 / 사용하기. slate 트랙 위에 흰 알약이 미끄러지는 형태. */
const SegmentedToggle = ({mode, onChange}: SegmentedToggleProps) => (
  <View style={s.track}>
    {(['earn', 'use'] as const).map(value => {
      const active = mode === value;
      const activeStyle = value === 'earn' ? s.earnStyle : s.useStyle;
      return (
        <Pressable
          key={value}
          onPress={() => onChange(value)}
          style={[s.segment, active && s.segmentActive, active && activeStyle]}>
          <Text style={[s.label, active && s.labelActive]}>
            {value === 'earn' ? '적립하기' : '사용하기'}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const s = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: p.slate[100],
    borderRadius: 14,
    padding: 6,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentActive: {
    shadowColor: p.gray[900],
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  earnStyle: {
    backgroundColor: p.blue[500],
  },
  useStyle: {
    backgroundColor: p.orange[500],
  },
  label: {
    fontSize: 16,
    fontFamily: f.medium,
    color: p.gray[400],
    letterSpacing: -0.4,
  },
  labelActive: {fontFamily: f.semibold, color: 'white'},
});

export default SegmentedToggle;
