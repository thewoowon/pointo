import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {primitives as p, displayFontFamily as df} from '../../../theme';
import {BearIcon} from '../../../components/decorations';
import {CouponIcon} from '../../../components/Icons';

const COLUMNS = 5;
const GAP = 16;
const MIN_DIAMETER = 36;
const MAX_DIAMETER = 58;

// i로부터 결정론적 유사난수(0~1). 곰 글리프의 회전·반전 변주에 쓴다 —
// 같은 칸은 매 렌더 같은 모양이어야 판이 흔들려 보이지 않는다.
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type StampCellProps = {
  index: number;
  diameter: number;
  filled: boolean;
  /** 마지막 칸 = 보상 자리. 비어 있으면 숫자 대신 쿠폰 아이콘 */
  isRewardSlot: boolean;
  anim: Animated.Value;
};

const StampCell = ({
  index,
  diameter,
  filled,
  isRewardSlot,
  anim,
}: StampCellProps) => {
  const glyph = diameter * 0.92;

  return (
    <View
      style={[
        s.cell,
        {width: diameter, height: diameter, borderRadius: diameter / 2},
      ]}>
      {filled ? (
        <Animated.View
          style={{
            opacity: anim,
            transform: [
              {
                scale: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
              },
              {rotate: `${(hash(index) - 0.5) * 36}deg`},
              {scaleX: hash(index + 7) > 0.5 ? -1 : 1},
            ],
          }}>
          <BearIcon size={glyph} color={p.base.white} />
        </Animated.View>
      ) : isRewardSlot ? (
        <CouponIcon color={p.blue[400]} />
      ) : (
        <Text style={[s.number, {fontSize: diameter * 0.28}]}>{index + 1}</Text>
      )}
    </View>
  );
};

type StampGridProps = {
  capacity: number;
  filled: number;
};

/**
 * 스탬프 판. 5열 고정에 세로로 흐른다.
 *
 * 채워진 칸은 흰 곰 글리프, 빈 칸은 순번 숫자, 마지막 칸만 쿠폰 아이콘 —
 * "여기까지 채우면 쿠폰"이라는 걸 판 자체가 말하게 하는 자리다.
 * 새로 찍힌 칸만 순서대로 톡톡 나타난다(이미 찍혀 있던 칸은 가만히 있는다).
 */
const StampGrid = ({capacity, filled}: StampGridProps) => {
  const [width, setWidth] = useState(0);

  // capacity개의 애니메이션 값을 참조 고정으로 유지
  const animsRef = useRef<Animated.Value[]>([]);
  if (animsRef.current.length !== capacity) {
    animsRef.current = Array.from(
      {length: Math.max(capacity, 0)},
      (_, i) => animsRef.current[i] ?? new Animated.Value(0),
    );
  }
  // 직전 렌더의 채움 수 — 어디부터가 "새로 찍힌 칸"인지 알아야 한다.
  const prevFilledRef = useRef(0);

  const shown = Math.min(Math.max(filled, 0), capacity);

  useEffect(() => {
    const prev = prevFilledRef.current;
    prevFilledRef.current = shown;

    // 줄어들었다면(쿠폰 발급으로 판 리셋) 애니메이션 없이 즉시 반영
    if (shown <= prev) {
      animsRef.current.forEach((v, i) => v.setValue(i < shown ? 1 : 0));
      return;
    }

    animsRef.current.slice(0, prev).forEach(v => v.setValue(1));
    const fresh = animsRef.current.slice(prev, shown);
    fresh.forEach(v => v.setValue(0));
    Animated.stagger(
      90,
      fresh.map(v =>
        Animated.spring(v, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
          tension: 90,
        }),
      ),
    ).start();
  }, [shown]);

  if (capacity <= 0) return null;

  const diameter = width
    ? Math.max(
        MIN_DIAMETER,
        Math.min(MAX_DIAMETER, (width - GAP * (COLUMNS - 1)) / COLUMNS),
      )
    : 0;

  return (
    <View
      style={s.grid}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        setWidth(prev => (prev === w ? prev : w));
      }}>
      {diameter > 0 &&
        Array.from({length: capacity}).map((_, i) => (
          <StampCell
            key={i}
            index={i}
            diameter={diameter}
            filled={i < shown}
            isRewardSlot={i === capacity - 1}
            anim={animsRef.current[i]}
          />
        ))}
    </View>
  );
};

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: GAP,
  },
  cell: {
    backgroundColor: p.blue[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontFamily: df.semibold,
    color: p.blue[400],
  },
});

export default StampGrid;
