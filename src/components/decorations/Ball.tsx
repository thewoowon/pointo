import React from 'react';
import {View} from 'react-native';

type BallProps = {
  size: number;
  color: string;
};

// 벚꽃 5장 꽃잎 형태
const Ball = ({size, color}: BallProps) => {
  const petalWidth = size * 0.38;
  const petalHeight = size * 0.52;
  const centerSize = size * 0.22;
  const offset = size * 0.22;

  const petals = [0, 72, 144, 216, 288];

  return (
    <View
      style={{
        width: size,
        height: size,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      {petals.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const tx = Math.sin(rad) * offset;
        const ty = -Math.cos(rad) * offset;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: petalWidth,
              height: petalHeight,
              backgroundColor: color,
              borderRadius: petalWidth / 2,
              opacity: 0.92,
              transform: [
                {translateX: tx},
                {translateY: ty},
                {rotate: `${angle}deg`},
              ],
              shadowColor: color,
              shadowOffset: {width: 0, height: 0},
              shadowOpacity: 0.5,
              shadowRadius: 6,
            }}
          />
        );
      })}
      {/* 꽃술 중앙 */}
      <View
        style={{
          position: 'absolute',
          width: centerSize,
          height: centerSize,
          backgroundColor: '#FFFDE7',
          borderRadius: centerSize / 2,
          borderWidth: 1.5,
          borderColor: '#FFD54F',
          shadowColor: '#FFD54F',
          shadowOffset: {width: 0, height: 0},
          shadowOpacity: 0.8,
          shadowRadius: 4,
          elevation: 3,
        }}
      />
    </View>
  );
};

export default Ball;
