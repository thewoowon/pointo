import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {primitives as p, fontFamily as f} from '../../../theme';
import type {useGivePoint} from '../useGivePoint';
import AmountInput from './AmountInput';
import Keypad from './Keypad';
import CouponPicker from './CouponPicker';
import {useTheme} from '../../../hooks';

type Give = ReturnType<typeof useGivePoint>;

/** 무엇을 하려는 참인지 한 줄로. 화면 전체에서 유일한 제목이다. */
export const giveTitle = (g: Give): string => {
  if (g.mode === 'earn') {
    return g.isPointMode
      ? '적립할 포인트를 입력해주세요'
      : '적립할 스탬프 개수를 입력해주세요';
  }
  return g.isPointMode
    ? '사용할 포인트를 입력해주세요'
    : '사용할 쿠폰을 선택해주세요';
};

/** 확인을 눌러도 되는 상태인지 */
export const canConfirm = (g: Give): boolean => {
  const amount = parseInt(g.number, 10) || 0;
  if (g.mode === 'earn') return amount >= 1;
  if (g.isPointMode) return amount >= 1 && amount <= g.user.points;
  return g.selectedCount > 0;
};

/** 확인 버튼 위 한 줄 — 누르면 어떻게 되는지 미리 알려 실수를 줄인다. */
const previewText = (g: Give): string => {
  const amount = parseInt(g.number, 10) || 0;
  const unit = g.storeConfig.pointUnit;

  if (g.mode === 'earn') {
    if (g.isPointMode) {
      return `적립 후 포인트 ${(
        g.user.points + amount
      ).toLocaleString()}${unit}`;
    }
    const spc = g.storeConfig.stampsPerCoupon;
    // handleApprove와 같은 기준을 써야 한다 — 레거시 문서는 stamps가 판을
    // 넘겨 누적돼 있어서(23 등), 나머지로 보정하지 않으면 발급 예정 장수가 부풀려진다.
    const total = (g.user.stamps % spc) + amount;
    return total >= spc
      ? `적립 후 스탬프 ${total % spc}/${spc}개 · 쿠폰 ${Math.floor(
          total / spc,
        )}장 발급`
      : `적립 후 스탬프 ${total}/${spc}개`;
  }

  if (g.isPointMode) {
    if (amount > g.user.points) return '보유 포인트보다 많이 사용할 수 없어요';
    return amount > 0
      ? `사용 후 포인트 ${(g.user.points - amount).toLocaleString()}${unit}`
      : '사용할 포인트를 입력해주세요';
  }

  return g.selectedCount > 0
    ? `쿠폰 ${g.selectedCount}장 사용 예정`
    : '사용할 쿠폰을 선택해주세요';
};

type GiveBodyProps = {
  g: Give;
  /** 쿠폰 목록에 내줄 수 있는 최대 높이 */
  couponListMaxHeight: number;
};

/**
 * 적립/사용 입력부. 태블릿 오른쪽 컬럼과 모바일 본문이 똑같이 쓴다.
 * 세그먼트 토글과 확인 버튼은 레이아웃마다 놓이는 자리가 달라서 밖에 둔다.
 */
const GiveBody = ({g, couponListMaxHeight}: GiveBodyProps) => {
  const isCouponUse = g.mode === 'use' && !g.isPointMode;
  const unit = g.isPointMode ? g.storeConfig.pointUnit : '개';
  const showPresets =
    g.isPointMode &&
    g.mode === 'earn' &&
    g.storeConfig.pointPresets?.length > 0;
  const t = useTheme();

  return (
    <View style={s.body}>
      <Text
        style={[
          s.title,
          {
            color:
              g.mode === 'earn'
                ? t.color.texticon.onNormal.primary
                : p.orange[500],
          },
        ]}>
        {giveTitle(g)}
      </Text>

      {isCouponUse ? (
        <CouponPicker
          entries={g.couponEntries}
          selectedKeys={g.selectedKeys}
          onToggle={g.toggleCoupon}
          onClear={g.clearSelection}
          expiryDays={g.storeConfig.couponExpiryDays}
          maxHeight={couponListMaxHeight}
        />
      ) : (
        <>
          <AmountInput value={g.number} unit={unit} />

          {showPresets && (
            <View style={s.presets}>
              {g.storeConfig.pointPresets.map(preset => {
                const active = g.number === String(preset.points);
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => g.setNumber(String(preset.points))}
                    style={[s.preset, active && s.presetActive]}>
                    <Text style={[s.presetText, active && s.presetTextActive]}>
                      {preset.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Keypad onPress={g.onNumberPress} />
        </>
      )}

      <Text style={s.preview}>{previewText(g)}</Text>
    </View>
  );
};

const s = StyleSheet.create({
  body: {width: '100%', gap: 20},
  title: {
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 28,
    fontFamily: f.bold,
    color: p.gray[900],
    letterSpacing: -0.6,
  },
  presets: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  preset: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: p.slate[100],
    borderWidth: 1,
    borderColor: p.slate[200],
  },
  presetActive: {backgroundColor: p.blue[50], borderColor: p.blue[500]},
  presetText: {
    fontSize: 14,
    fontFamily: f.medium,
    color: p.gray[700],
    letterSpacing: -0.3,
  },
  presetTextActive: {fontFamily: f.semibold, color: p.blue[500]},
  preview: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: f.regular,
    color: p.gray[400],
    letterSpacing: -0.3,
  },
});

export default GiveBody;
