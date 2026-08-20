import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';
import {LeftArrowIcon} from '../../../components/Icons';

// 빈 칸은 0을 가운데에 두기 위한 자리 (누를 수 없음)
const KEYS: (number | string)[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['', 0, 'c'],
];

type KeypadProps = {
  onPress: (key: number | string) => void;
};

const Keypad = ({onPress}: KeypadProps) => (
  <View style={s.pad}>
    {KEYS.map((row, ri) => (
      <View key={ri} style={s.row}>
        {row.map((key, ki) => (
          <Pressable
            key={ki}
            disabled={key === ''}
            style={({pressed}) => [s.key, pressed && key !== '' && s.keyPressed]}
            onPress={() => onPress(key)}>
            {key === 'c' ? (
              <LeftArrowIcon />
            ) : (
              <Text style={s.keyText}>{key}</Text>
            )}
          </Pressable>
        ))}
      </View>
    ))}
  </View>
);

const s = StyleSheet.create({
  pad: {gap: 4},
  row: {flexDirection: 'row'},
  key: {
    flex: 1,
    height: 68,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyPressed: {backgroundColor: p.slate[100]},
  keyText: {
    fontSize: 28,
    fontFamily: f.medium,
    color: p.gray[900],
  },
});

export default Keypad;
