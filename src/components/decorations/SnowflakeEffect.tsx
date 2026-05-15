import React, {useEffect, useRef} from 'react';
import {Animated, Easing, View} from 'react-native';

// 벚꽃 꽃잎 색상
const PETAL_COLORS = ['#FFCBA4', '#FFD9B5', '#FFDBC2', '#FFE8CC', '#FFAA80'];

type PetalProps = {
  delay: number;
  left: number;
  size: number;
  color: string;
  rotation: number;
};

const Petal = ({delay, left, size, color, rotation}: PetalProps) => {
  const translateY = useRef(new Animated.Value(-30)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = 7000 + Math.random() * 5000;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.85,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 900,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(translateX, {toValue: 20, duration: duration / 4, easing: Easing.sin, useNativeDriver: true}),
            Animated.timing(translateX, {toValue: -20, duration: duration / 4, easing: Easing.sin, useNativeDriver: true}),
            Animated.timing(translateX, {toValue: 12, duration: duration / 4, easing: Easing.sin, useNativeDriver: true}),
            Animated.timing(translateX, {toValue: 0, duration: duration / 4, easing: Easing.sin, useNativeDriver: true}),
          ]),
          Animated.timing(rotate, {
            toValue: 1,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(translateY, {toValue: -30, duration: 0, useNativeDriver: true}),
          Animated.timing(rotate, {toValue: 0, duration: 0, useNativeDriver: true}),
        ]),
      ]),
    );

    animation.start();

    return () => {
      translateY.stopAnimation();
      translateX.stopAnimation();
      opacity.stopAnimation();
      rotate.stopAnimation();
    };
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: [`${rotation}deg`, `${rotation + 360}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${left}%`,
        transform: [{translateY}, {translateX}, {rotate: spin}],
        opacity,
      }}>
      {/* 꽃잎 타원형 */}
      <View
        style={{
          width: size,
          height: size * 1.4,
          backgroundColor: color,
          borderRadius: size / 2,
          shadowColor: color,
          shadowOffset: {width: 0, height: 0},
          shadowOpacity: 0.6,
          shadowRadius: 3,
        }}
      />
    </Animated.View>
  );
};

type SnowflakeEffectProps = {
  count?: number;
};

const SnowflakeEffect = ({count = 20}: SnowflakeEffectProps) => {
  const petals = Array.from({length: count}, (_, i) => ({
    id: i,
    delay: Math.random() * 6000,
    left: Math.random() * 100,
    size: 5 + Math.random() * 6,
    color: PETAL_COLORS[i % PETAL_COLORS.length],
    rotation: Math.random() * 360,
  }));

  return (
    <View
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
      pointerEvents="none">
      {petals.map(petal => (
        <Petal
          key={petal.id}
          delay={petal.delay}
          left={petal.left}
          size={petal.size}
          color={petal.color}
          rotation={petal.rotation}
        />
      ))}
    </View>
  );
};

export default SnowflakeEffect;
