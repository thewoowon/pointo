import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';

type AmountInputProps = {
  /** 빈 문자열이면 placeholder 0을 회색으로 */
  value: string;
  unit: string;
};

/** 키패드가 채우는 표시 전용 입력창. 실제 포커스/커서는 없다. */
const AmountInput = ({value, unit}: AmountInputProps) => {
  const empty = value.length === 0;
  const shown = empty ? '0' : Number(value).toLocaleString();

  return (
    <View style={s.box}>
      <Text
        style={[s.value, empty && s.placeholder]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {shown}
      </Text>
      <Text style={s.unit}>{unit}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    height: 80,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: p.blue[500],
    backgroundColor: p.base.white,
  },
  value: {
    fontSize: 38,
    fontFamily: f.semibold,
    color: p.gray[900],
    letterSpacing: -1,
  },
  placeholder: {color: p.gray[300]},
  unit: {
    fontSize: 20,
    fontFamily: f.semibold,
    color: p.gray[700],
    letterSpacing: -0.4,
  },
});

export default AmountInput;
