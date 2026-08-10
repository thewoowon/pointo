import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';

type ConfirmButtonProps = {
  enabled: boolean;
  onPress: () => void;
  label?: string;
};

const ConfirmButton = ({
  enabled,
  onPress,
  label = '확인',
}: ConfirmButtonProps) => (
  <Pressable
    disabled={!enabled}
    onPress={onPress}
    style={({pressed}) => [
      s.button,
      enabled ? s.enabled : s.disabled,
      enabled && pressed && s.pressed,
    ]}>
    <Text style={[s.label, enabled ? s.labelEnabled : s.labelDisabled]}>
      {label}
    </Text>
  </Pressable>
);

const s = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enabled: {backgroundColor: p.blue[500]},
  pressed: {backgroundColor: p.blue[600]},
  disabled: {backgroundColor: p.slate[200]},
  label: {fontSize: 16, fontFamily: f.semibold, letterSpacing: -0.4},
  labelEnabled: {color: p.base.white},
  labelDisabled: {color: p.gray[400]},
});

export default ConfirmButton;
