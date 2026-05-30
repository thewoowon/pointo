import React, {useEffect, useRef} from 'react';
import {Animated, Easing, View} from 'react-native';

// 여름 바다 버블 색상
const BUBBLE_COLORS = ['#B3E5FC', '#81D4FA', '#4FC3F7', '#E0F7FA', '#B2EBF2'];

type BubbleProps = {
  delay: number;
  left: number;
  size: number;
  color: string;
};

const Bubble = ({delay, left, size, color}: BubbleProps) => {
  const translateY = useRef(new Animated.Value(900)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const duration = 8000 + Math.random() * 6000;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -60,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(translateX, {toValue: 15, duration: duration / 3, easing: Easing.sin, useNativeDriver: true}),
            Animated.timing(translateX, {toValue: -15, duration: duration / 3, easing: Easing.sin, useNativeDriver: true}),
            Animated.timing(translateX, {toValue: 0, duration: duration / 3, easing: Easing.sin, useNativeDriver: true}),
          ]),
        ]),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(translateY, {toValue: 900, duration: 0, useNativeDriver: true}),
          Animated.timing(scale, {toValue: 0.6, duration: 0, useNativeDriver: true}),
        ]),
      ]),
    );

    animation.start();

    return () => {
      translateY.stopAnimation();
      translateX.stopAnimation();
      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${left}%`,
        transform: [{translateY}, {translateX}, {scale}],
        opacity,
      }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.6)',
          shadowColor: color,
          shadowOffset: {width: 0, height: 0},
          shadowOpacity: 0.4,
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
  const bubbles = Array.from({length: count}, (_, i) => ({
    id: i,
    delay: Math.random() * 6000,
    left: Math.random() * 100,
    size: 4 + Math.random() * 8,
    color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
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
      {bubbles.map(bubble => (
        <Bubble
          key={bubble.id}
          delay={bubble.delay}
          left={bubble.left}
          size={bubble.size}
          color={bubble.color}
        />
      ))}
    </View>
  );
};

export default SnowflakeEffect;
