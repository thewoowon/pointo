import React, {useEffect, useRef} from 'react';
import {
  Animated,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';

const PARTICLES = ['☕', '✨', '🎉', '⭐', '🌟', '💫', '🎊', '☕', '✨'];

const AmericanoCouponOverlay = ({
  show,
  onDismiss,
  couponName,
}: {
  show: boolean;
  onDismiss?: () => void;
  couponName?: string;
}) => {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (show) {
      scale.setValue(0.5);
      opacity.setValue(0);
      bgOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [show]);

  if (!show) return null;

  return (
    <Pressable
      onPress={onDismiss}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
      }}>
      {/* 어두운 배경 */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.82)',
          opacity: bgOpacity,
        }}
      />

      {/* 파티클 */}
      {PARTICLES.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            top: `${8 + (i * 11) % 80}%`,
            left: `${(i * 23) % 90}%`,
            fontSize: 20 + (i % 3) * 6,
            opacity: opacity,
            transform: [{scale}],
          }}>
          {p}
        </Animated.Text>
      ))}

      {/* 메인 카드 */}
      <Animated.View
        style={{
          alignItems: 'center',
          gap: 16,
          transform: [{scale}],
          opacity,
        }}>
        <Image
          source={require('../../assets/images/americano_coupon.png')}
          style={{width: 278, height: 278, marginBottom: 8}}
        />
        <Text
          style={{
            fontSize: 48,
            lineHeight: 52,
            fontFamily: 'Pretendard-Bold',
            letterSpacing: -1,
            color: '#fff',
          }}>
          쿠폰 획득! 🎉
        </Text>
        <Text
          style={{
            fontSize: 20,
            lineHeight: 28,
            fontFamily: 'Pretendard-Medium',
            letterSpacing: -0.5,
            color: '#fff',
          }}>
          다음 <Text style={{color: '#FF8400'}}>{couponName ?? '쿠폰 A'}</Text> 무료!
        </Text>

        {/* 닫기 힌트 */}
        <View
          style={{
            marginTop: 16,
            paddingVertical: 8,
            paddingHorizontal: 24,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 20,
          }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Pretendard-Regular',
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: -0.3,
            }}>
            화면을 터치하면 닫힙니다
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
};

export default AmericanoCouponOverlay;
