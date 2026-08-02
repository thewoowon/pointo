import React, {useEffect, useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useTheme} from '../../hooks';
import type {Theme} from '../../theme';
import {
  CircleMinusIcon,
  CirclePlusIcon,
  LeftArrowIcon,
  NewXIcon,
} from '../../components/Icons';
import {totalSelected} from '../../utils/coupons';
import {useGivePoint} from './useGivePoint';
import {maskPhone} from './logDisplay';

const KEYS: (number | string)[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['', 0, 'c'],
];

/**
 * 모바일 적립/사용 2-스텝 바텀시트 (태블릿 DetailView의 모바일 대응).
 * step 'choice' → 사용/적립 선택, step 'input' → 키패드(적립·포인트) 또는 쿠폰 스테퍼(스탬프 사용).
 * 계산 로직은 useGivePoint 단일 소스 공유.
 */
const GivePointSheet = ({
  visible,
  phoneNumber,
  updateLogs,
}: {
  visible: boolean;
  phoneNumber: string;
  updateLogs: () => void;
}) => {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const g = useGivePoint(phoneNumber, updateLogs);
  const [step, setStep] = useState<'choice' | 'input'>('choice');

  // 새 세션이 열릴 때마다 선택 단계로 초기화
  useEffect(() => {
    if (visible) setStep('choice');
  }, [visible, phoneNumber]);

  const holding = g.isPointMode
    ? `${g.user.stamps.toLocaleString()}${g.storeConfig.pointUnit}`
    : `${g.user.stamps % g.storeConfig.stampsPerCoupon}/${
        g.storeConfig.stampsPerCoupon
      }개`;

  const numberUnit = g.isPointMode
    ? g.storeConfig.pointUnit
    : g.mode === 'use'
    ? '장'
    : '개';

  const inputTitle =
    g.mode === 'earn'
      ? g.isPointMode
        ? '적립할 포인트를\n입력해주세요'
        : '적립할 스탬프 개수를\n입력해주세요'
      : g.isPointMode
      ? '사용할 포인트를\n입력해주세요'
      : '사용할 쿠폰을\n선택해주세요';

  const onConfirm = () => {
    if (g.mode === 'earn') {
      g.isPointMode ? g.handleApprovePoint() : g.handleApprove();
    } else {
      g.isPointMode ? g.handleUsingPoint() : g.handleUsing();
    }
  };

  // 스탬프 사용만 쿠폰 스테퍼, 그 외(적립/포인트)는 숫자 키패드
  const isCouponUse = g.mode === 'use' && !g.isPointMode;

  const infoCard = (
    <View style={s.infoCard}>
      <View style={s.infoRow}>
        <Text style={s.infoLabel}>고객 번호</Text>
        <Text style={s.infoValue}>{maskPhone(phoneNumber)}</Text>
      </View>
      <View style={s.infoRow}>
        <Text style={s.infoLabel}>
          {g.isPointMode ? '보유 포인트' : '보유 스탬프 개수'}
        </Text>
        <Text style={s.infoValue}>{holding}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={g.close}>
      <Pressable style={s.backdrop} onPress={g.close}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <View style={s.topRow}>
            {step === 'input' ? (
              <Pressable
                onPress={() => setStep('choice')}
                hitSlop={8}
                style={s.topBtn}>
                <LeftArrowIcon width={20} height={20} />
              </Pressable>
            ) : (
              <View style={s.topBtn} />
            )}
            <Pressable onPress={g.close} hitSlop={8} style={s.topBtn}>
              <NewXIcon width={20} height={20} />
            </Pressable>
          </View>

          {step === 'choice' ? (
            <>
              <Text style={s.title}>
                고객님의 {g.isPointMode ? '포인트' : '스탬프'} 사용 또는{'\n'}
                적립하기를 선택해주세요
              </Text>
              {infoCard}
              <View style={s.choiceRow}>
                <Pressable
                  style={[s.choiceBtn, {backgroundColor: theme.palette.blue[50]}]}
                  onPress={() => {
                    g.switchMode('use');
                    setStep('input');
                  }}>
                  <CircleMinusIcon
                    color={theme.color.texticon.onNormal.primary}
                  />
                  <Text
                    style={[
                      s.choiceText,
                      {color: theme.color.texticon.onNormal.primary},
                    ]}>
                    사용하기
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    s.choiceBtn,
                    {backgroundColor: theme.palette.orange[100]},
                  ]}
                  onPress={() => {
                    g.switchMode('earn');
                    setStep('input');
                  }}>
                  <CirclePlusIcon color={theme.palette.orange[600]} />
                  <Text
                    style={[s.choiceText, {color: theme.palette.orange[600]}]}>
                    적립하기
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={s.title}>{inputTitle}</Text>
              {infoCard}

              {isCouponUse ? (
                <ScrollView style={s.stepperScroll}>
                  <Text style={s.sectionLabel}>사용가능쿠폰</Text>
                  {g.storeConfig.couponTypes.map(ct => {
                    const owned = g.userContext.possibleCoupons[ct.id] ?? 0;
                    if (owned <= 0) return null;
                    const selected = g.userContext.selectedCoupon[ct.id] ?? 0;
                    return (
                      <View key={ct.id} style={s.stepperRow}>
                        <Text style={s.stepperName}>
                          {owned}개{'  '}
                          <Text style={s.stepperSub}>({ct.name})</Text>
                        </Text>
                        <View style={s.stepperCtrl}>
                          <Pressable
                            onPress={() => g.adjustCoupon(ct.id, -1)}
                            hitSlop={6}>
                            <CircleMinusIcon
                              color={
                                selected > 0
                                  ? theme.color.texticon.onNormal.primary
                                  : theme.palette.gray[300]
                              }
                            />
                          </Pressable>
                          <Text style={s.stepperCount}>{selected}</Text>
                          <Pressable
                            onPress={() => g.adjustCoupon(ct.id, 1)}
                            hitSlop={6}>
                            <CirclePlusIcon
                              color={
                                selected < owned
                                  ? theme.color.texticon.onNormal.primary
                                  : theme.palette.gray[300]
                              }
                            />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <>
                  <View style={s.numberRow}>
                    <Text
                      style={[
                        s.numberText,
                        {
                          color:
                            g.number.length > 0
                              ? theme.color.texticon.onNormal.highestemp
                              : theme.palette.gray[300],
                        },
                      ]}>
                      {g.number || '0'}
                    </Text>
                    <Text style={s.numberUnit}>{numberUnit}</Text>
                  </View>
                  <View style={s.keypad}>
                    {KEYS.map((row, ri) => (
                      <View key={ri} style={s.keyRow}>
                        {row.map((key, ki) => (
                          <Pressable
                            key={ki}
                            style={({pressed}) => [
                              s.key,
                              key !== '' &&
                                pressed && {
                                  backgroundColor:
                                    theme.color.surface.normal.container10,
                                },
                            ]}
                            onPress={() =>
                              key !== '' && g.onNumberPress(key)
                            }>
                            {key === 'c' ? (
                              <LeftArrowIcon />
                            ) : (
                              <Text style={s.keyText}>{key}</Text>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Pressable
                style={({pressed}) => [
                  s.confirmBtn,
                  {
                    backgroundColor: pressed
                      ? theme.palette.blue[700]
                      : theme.color.surface.brand.primary,
                  },
                ]}
                onPress={onConfirm}>
                <Text style={s.confirmText}>
                  {isCouponUse && totalSelected(g.userContext.selectedCoupon) > 0
                    ? `쿠폰 ${totalSelected(
                        g.userContext.selectedCoupon,
                      )}장 사용하기`
                    : '확인'}
                </Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.color.surface.normal.bg1,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 40,
      gap: 20,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    topBtn: {width: 24, height: 24, justifyContent: 'center', alignItems: 'center'},
    title: {
      textAlign: 'center',
      fontFamily: theme.font.semibold,
      fontSize: 20,
      lineHeight: 30,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.highestemp,
    },
    infoCard: {
      backgroundColor: theme.color.surface.normal.container10,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 18,
      gap: 12,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    infoLabel: {
      fontFamily: theme.font.regular,
      fontSize: 15,
      letterSpacing: -0.3,
      color: theme.color.texticon.onNormal.midemp,
    },
    infoValue: {
      fontFamily: theme.font.semibold,
      fontSize: 16,
      letterSpacing: -0.3,
      color: theme.color.texticon.onNormal.highestemp,
    },
    choiceRow: {flexDirection: 'row', gap: 12},
    choiceBtn: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      height: 60,
      borderRadius: 16,
    },
    choiceText: {
      fontFamily: theme.font.semibold,
      fontSize: 18,
      letterSpacing: -0.5,
    },
    sectionLabel: {
      fontFamily: theme.font.semibold,
      fontSize: 15,
      letterSpacing: -0.3,
      color: theme.color.texticon.onNormal.highemp,
      marginBottom: 12,
    },
    stepperScroll: {maxHeight: 260},
    stepperRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.color.surface.normal.container10,
      borderRadius: 14,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 12,
    },
    stepperName: {
      fontFamily: theme.font.bold,
      fontSize: 17,
      letterSpacing: -0.5,
      color: theme.color.texticon.onNormal.highestemp,
    },
    stepperSub: {
      fontFamily: theme.font.regular,
      fontSize: 14,
      color: theme.color.texticon.onNormal.midemp,
    },
    stepperCtrl: {flexDirection: 'row', alignItems: 'center', gap: 16},
    stepperCount: {
      fontFamily: 'SFUIDisplay-Semibold',
      fontSize: 18,
      minWidth: 20,
      textAlign: 'center',
      color: theme.color.texticon.onNormal.highestemp,
    },
    numberRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'baseline',
      gap: 8,
      paddingVertical: 8,
    },
    numberText: {
      fontFamily: 'SFUIDisplay-Semibold',
      fontSize: 44,
      letterSpacing: -1,
    },
    numberUnit: {
      fontFamily: theme.font.semibold,
      fontSize: 22,
      color: theme.color.texticon.onNormal.highemp,
    },
    keypad: {gap: 8},
    keyRow: {flexDirection: 'row', justifyContent: 'center', gap: 8},
    key: {
      flex: 1,
      height: 52,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    keyText: {
      fontFamily: 'SFUIDisplay-Semibold',
      fontSize: 26,
      color: theme.color.texticon.onNormal.highestemp,
    },
    confirmBtn: {
      height: 56,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    confirmText: {
      fontFamily: theme.font.semibold,
      fontSize: 18,
      letterSpacing: -0.5,
      color: theme.color.etc.absolute.white,
    },
  });

export default GivePointSheet;
