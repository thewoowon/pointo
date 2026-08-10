import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';

type LevelPillProps = {
  level: number;
  name: string;
  emoji: string;
};

/** 인사말 아래 붙는 회색 알약. 'LV.1 새싹 🌱' */
const LevelPill = ({level, name, emoji}: LevelPillProps) => (
  <View style={s.pill}>
    <Text style={s.lv}>LV.{level}</Text>
    <Text style={s.name}>{name}</Text>
    <Text style={s.emoji}>{emoji}</Text>
  </View>
);

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: p.gray[100],
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: p.slate[200],
  },
  lv: {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: f.regular,
    color: p.gray[700],
    letterSpacing: -0.3,
  },
  name: {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: f.regular,
    color: p.gray[700],
    letterSpacing: -0.3,
  },
  emoji: {fontSize: 10},
});

export default LevelPill;
