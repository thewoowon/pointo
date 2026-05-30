import React from 'react';
import {View, Text} from 'react-native';

type Props = {
  show: boolean;
  remaining: 1 | 2;
  couponName?: string;
};

const StampNearOverlay = ({show, remaining, couponName}: Props) => {
  if (!show) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
        gap: 16,
      }}>
      <Text style={{fontSize: 80, marginBottom: 8}}>
        {remaining === 1 ? '1' : '2'}
      </Text>
      <Text
        style={{
          fontSize: 42,
          lineHeight: 45,
          fontFamily: 'Pretendard-Bold',
          letterSpacing: -1,
          color: '#fff',
        }}>
        {remaining}개만 더!
      </Text>
      <View
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Text
          style={{
            fontSize: 20,
            lineHeight: 28,
            fontFamily: 'Pretendard-Medium',
            letterSpacing: -0.5,
            color: '#fff',
          }}>
          스탬프{' '}
          <Text style={{color: '#FF8400'}}>{remaining}개</Text>만 더 모으면{' '}
        </Text>
        <Text
          style={{
            fontSize: 20,
            lineHeight: 28,
            fontFamily: 'Pretendard-Medium',
            letterSpacing: -0.5,
            color: '#fff',
          }}>
          {couponName ?? '쿠폰'} 무료 쿠폰이 한장 생겨요!
        </Text>
      </View>
    </View>
  );
};

export default StampNearOverlay;
