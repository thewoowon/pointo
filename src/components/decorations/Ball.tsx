import React from 'react';
import {View} from 'react-native';

type BallProps = {
  size: number;
  color: string;
};

// 비치발리볼 형태
const Ball = ({size, color}: BallProps) => {
  const stripeHeight = size * 0.18;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: color,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.06)',
      }}>
      {/* 상단 줄무늬 */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          width: size * 0.9,
          height: stripeHeight,
          backgroundColor: color,
          borderRadius: stripeHeight / 2,
          opacity: 0.85,
        }}
      />
      {/* 중앙 줄무늬 */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.41,
          width: size,
          height: stripeHeight,
          backgroundColor: color,
          opacity: 0.9,
        }}
      />
      {/* 하단 줄무늬 */}
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.12,
          width: size * 0.9,
          height: stripeHeight,
          backgroundColor: color,
          borderRadius: stripeHeight / 2,
          opacity: 0.85,
        }}
      />
    </View>
  );
};

export default Ball;
