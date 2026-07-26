import React, {useCallback, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  useAuth,
  useFirestore,
  useAnalytics,
  useStoreConfig,
  useLayoutMode,
  useTheme,
} from '../../hooks';
import type {Theme} from '../../theme';
import {
  doc,
  getFirestore,
  onSnapshot,
  Timestamp,
} from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';
import dayjs from 'dayjs';
import {
  AnalyticsEvent,
  hashPhone,
  getTierFromLevel,
} from '../../analytics/events';
import {
  CircleMinusIcon,
  CirclePlusIcon,
  LeftArrowIcon,
  NewXIcon,
  RefreshIcon,
} from '../../components/Icons';
import LinearGradient from 'react-native-linear-gradient';
import {confirm} from '../../utils/alert';
import {
  normalizeUser,
  flattenCouponsForFirestore,
  makeUserContext,
  totalSelected,
  addCouponTimestamp,
  removeCouponTimestamps,
  filterExpiredCoupons,
} from '../../utils/coupons';

const NUMBER_SEQUENCE = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

const DetailView = ({
  navigation,
  phoneNumber,
  updateLogs,
}: {
  navigation: any;
  phoneNumber: string;
  onClose: () => void;
  updateLogs: () => void;
}) => {
  const {isCompact} = useLayoutMode();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const {track} = useAnalytics();
  const [mode, setMode] = useState<'earn' | 'use'>('earn');
  const [number, setNumber] = useState('');
  const [user, setUser] = useState<User>({
    last_used: '',
    level: 0,
    stamps: 0,
    phase: storeConfig.couponSequence[0] ?? 'americano',
    coupons: {},
    hasRated: false,
  });

  const [userContext, setUserContext] = useState<UserContext>({
    selectedCoupon: {},
    possibleCoupons: {},
  });

  const {updateUser, updateSession, addLog, resolveUserDocId} =
    useFirestore(storeCode);

  const isPointMode = storeConfig.mode === 'point';

  const handleApprovePoint = async () => {
    if (number.length === 0) {
      Alert.alert('적립할 포인트를 입력해주세요', '다시 입력해주세요.');
      return;
    }
    const pointValue = parseInt(number, 10);
    if (isNaN(pointValue) || pointValue < 1) {
      Alert.alert('적립할 포인트를 1 이상 입력해주세요', '다시 입력해주세요.');
      return;
    }

    const newStamps = user.stamps + pointValue;
    await updateUser(phoneNumber, {
      stamps: newStamps,
      last_used: new Date().toISOString().split('T')[0],
    });

    addLog({
      action: 'stamp_saved',
      phone_number: phoneNumber,
      stamp: pointValue,
      timestamp: Timestamp.now(),
      note: `${pointValue.toLocaleString()}${storeConfig.pointUnit} 적립`,
      store_code: storeCode ?? undefined,
      user_level: user.level,
    });

    try {
      const userId = hashPhone(phoneNumber);
      const daysSinceSignup = user.created_at
        ? dayjs().diff(dayjs(user.created_at), 'day')
        : 0;
      track(AnalyticsEvent.STAMP_EARNED, {
        store_code: storeCode,
        user_id: userId,
        user_tier: getTierFromLevel(user.level, storeConfig.levelTiers),
        user_level: user.level,
        stamps_total: newStamps,
        days_since_signup: daysSinceSignup,
        stamp_count: pointValue,
      });
    } catch (error) {
      console.log('Error logging point earned event:', error);
    }

    setNumber('');
    updateLogs();
  };

  const handleUsingPoint = async () => {
    const pointsToUse = parseInt(number, 10);
    if (isNaN(pointsToUse) || pointsToUse < 1) {
      Alert.alert('사용할 포인트를 입력해주세요', '다시 입력해주세요.');
      return;
    }
    if (pointsToUse > user.stamps) {
      Alert.alert('포인트 부족', '보유 포인트보다 많이 사용할 수 없습니다.');
      return;
    }

    const newStamps = user.stamps - pointsToUse;
    await updateUser(phoneNumber, {
      stamps: newStamps,
      last_used: new Date().toISOString().split('T')[0],
    });

    addLog({
      action: 'stamp_used',
      phone_number: phoneNumber,
      stamp: pointsToUse,
      timestamp: Timestamp.now(),
      note: `${pointsToUse.toLocaleString()}${storeConfig.pointUnit} 사용`,
      store_code: storeCode ?? undefined,
      user_level: user.level,
    });

    try {
      const daysSinceSignup = user.created_at
        ? dayjs().diff(dayjs(user.created_at), 'day')
        : 0;
      track(AnalyticsEvent.COUPON_REDEEMED, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
        user_tier: getTierFromLevel(user.level, storeConfig.levelTiers),
        user_level: user.level,
        stamps_total: newStamps,
        days_since_signup: daysSinceSignup,
        points_used: pointsToUse,
      });
    } catch (error) {
      console.log('Error logging point used event:', error);
    }

    setNumber('');
    updateLogs();
  };

  const handleApprove = async () => {
    console.log('handleApprove', phoneNumber, number);
    if (number.length === 0) {
      Alert.alert('적립할 스탬프를 입력해주세요', '다시 입력해주세요.');
      return;
    }

    const numberValue = parseInt(number, 10);

    if (numberValue < 1) {
      Alert.alert(
        '적립할 스탬프를 1개 이상 입력해주세요',
        '다시 입력해주세요.',
      );
      return;
    }

    if (numberValue > 100) {
      Alert.alert(
        '적립하는 쿠폰의 수가 많은 것 같아요',
        '한 번 더 확인해주세요.',
      );
      return;
    }

    const spc = storeConfig.stampsPerCoupon;
    // 레거시 누적 스탬프 보정 (23 → 3)
    const currentStamps = user.stamps % spc;
    const stampsAfterEarn = currentStamps + numberValue;
    const difference = Math.floor(stampsAfterEarn / spc);
    // 스탬프 카드 모델: 쿠폰 획득 시 나머지만 유지
    const stampsTotal = stampsAfterEarn % spc;

    const previousLevel = user.level;
    let level = user.level;
    let phase = user.phase;
    const coupons = {...user.coupons};

    const seq = storeConfig.couponSequence;
    // phase가 현재 시퀀스에 없으면 첫 번째로 보정
    if (seq.indexOf(phase) === -1) {
      phase = seq[0];
    }
    let issuedAt = user.couponIssuedAt;
    for (let index = 0; index < difference; index++) {
      const currentIdx = seq.indexOf(phase);
      coupons[phase] = (coupons[phase] ?? 0) + 1;
      issuedAt = addCouponTimestamp(issuedAt, phase, 1);
      if (phase === storeConfig.levelIncrementOn) {
        level += 1;
      }
      phase = seq[(currentIdx + 1) % seq.length];
    }

    const updateContext = {
      stamps: stampsTotal,
      phase,
      ...flattenCouponsForFirestore(coupons, storeConfig.couponTypes),
      couponIssuedAt: issuedAt ?? {},
      level,
      last_used: new Date().toISOString().split('T')[0],
    };

    await updateUser(phoneNumber, updateContext);

    addLog({
      action: 'stamp_saved',
      phone_number: phoneNumber,
      stamp: numberValue,
      timestamp: Timestamp.now(),
      note: '',
      store_code: storeCode ?? undefined,
      user_level: level,
      coupons_issued: difference,
    });

    try {
      const userId = hashPhone(phoneNumber);
      const daysSinceSignup = user.created_at
        ? dayjs().diff(dayjs(user.created_at), 'day')
        : 0;
      const commonParams = {
        store_code: storeCode,
        user_id: userId,
        user_tier: getTierFromLevel(level, storeConfig.levelTiers),
        user_level: level,
        stamps_total: stampsTotal,
        days_since_signup: daysSinceSignup,
      };

      track(AnalyticsEvent.STAMP_EARNED, {
        ...commonParams,
        stamp_count: numberValue,
      });

      if (difference > 0) {
        track(AnalyticsEvent.COUPON_ISSUED, {
          ...commonParams,
          coupons_issued: difference,
          coupons_total: coupons,
        });
      }

      const previousTier = getTierFromLevel(
        previousLevel,
        storeConfig.levelTiers,
      );
      const newTier = getTierFromLevel(level, storeConfig.levelTiers);
      if (previousTier !== newTier) {
        track(AnalyticsEvent.TIER_UP, {
          ...commonParams,
          from_tier: previousTier,
          to_tier: newTier,
          from_level: previousLevel,
          to_level: level,
        });
      }
    } catch (error) {
      console.log('Error logging stamp earned event:', error);
    }

    setNumber('');

    // Toast.show({
    //   type: 'custom_type',
    //   text1: `스탬프 ${numberValue}개 적립되었습니다`,
    //   text2: phoneNumber,
    //   visibilityTime: 5000,
    //   onPress: () => {
    //     Toast.hide();
    //   },
    // });

    // await updateSession(`session_${storeCode}`, {
    //   last_used: new Date().toISOString().split('T')[0],
    //   phone: '',
    //   mode: 'waiting',
    // });

    updateLogs();
  };

  const handleUsing = async () => {
    console.log('handleUsing', phoneNumber);
    const selected = totalSelected(userContext.selectedCoupon);
    if (selected < 1) {
      Alert.alert('사용할 쿠폰을 선택해주세요', '쿠폰을 눌러 선택해주세요.');
      return;
    }

    // 쿠폰만 차감 (스탬프 카드 모델: 쿠폰 사용 시 스탬프 변동 없음)
    const remainingCoupons: Record<string, number> = {};
    for (const ct of storeConfig.couponTypes) {
      remainingCoupons[ct.id] =
        (userContext.possibleCoupons[ct.id] ?? 0) -
        (userContext.selectedCoupon[ct.id] ?? 0);
    }
    const remainingIssuedAt = removeCouponTimestamps(
      user.couponIssuedAt,
      userContext.selectedCoupon,
    );
    await updateUser(phoneNumber, {
      ...flattenCouponsForFirestore(remainingCoupons, storeConfig.couponTypes),
      couponIssuedAt: remainingIssuedAt,
    });

    const noteString = storeConfig.couponTypes
      .filter(ct => (userContext.selectedCoupon[ct.id] ?? 0) > 0)
      .map(ct => `${ct.name} ${userContext.selectedCoupon[ct.id]}장`)
      .join(' ');

    addLog({
      action: 'stamp_used',
      phone_number: phoneNumber,
      stamp: 0,
      timestamp: Timestamp.now(),
      note: noteString,
      store_code: storeCode ?? undefined,
      user_level: user.level,
    });

    try {
      const daysSinceSignup = user.created_at
        ? dayjs().diff(dayjs(user.created_at), 'day')
        : 0;
      track(AnalyticsEvent.COUPON_REDEEMED, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
        user_tier: getTierFromLevel(user.level, storeConfig.levelTiers),
        user_level: user.level,
        stamps_total: user.stamps,
        days_since_signup: daysSinceSignup,
        coupons_redeemed: userContext.selectedCoupon,
      });
    } catch (error) {
      console.log('Error logging coupon redeemed event:', error);
    }

    setNumber('');
    updateLogs();
  };

  const switchMode = (newMode: 'earn' | 'use') => {
    setMode(newMode);
    setNumber('');
    setUserContext(makeUserContext(user.coupons, storeConfig.couponTypes));
  };

  const refresh = async () => {
    try {
      track(AnalyticsEvent.STAMP_RESET, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
      });
    } catch (error) {
      console.log('Error logging stamp reset event:', error);
    }
    console.log('refresh', phoneNumber);
    const result = await confirm('쿠폰 입력 확인', '쿠폰을 초기화하시겠어요?');
    if (!result) {
      return;
    }

    setNumber('');
    setUserContext(makeUserContext(user.coupons, storeConfig.couponTypes));
  };

  const onNumberPress = async (value: number | string) => {
    // 스탬프 모드 사용 시 숫자 패드 비활성화 (쿠폰 선택만 가능)
    if (mode === 'use' && !isPointMode) return;

    if (typeof value === 'number') {
      const maxLen = isPointMode ? 7 : 3;
      if (number.length > maxLen) {
        Alert.alert(
          isPointMode
            ? '적립하는 포인트가 많은 것 같아요'
            : '적립하는 스탬프의 수가 많은 것 같아요',
          '한 번 더 확인해주세요.',
        );
        return;
      }

      const nextNumber = parseInt(number + value, 10);

      setNumber(nextNumber.toString());
      return;
    }

    if (typeof value === 'string') {
      if (value === 'c') {
        setNumber(number.slice(0, -1));
        return;
      }

      if (value === '+10') {
        const maxLen = isPointMode ? 7 : 3;
        if (number.length > maxLen) {
          Alert.alert(
            isPointMode
              ? '적립하는 포인트가 많은 것 같아요'
              : '적립하는 스탬프의 수가 많은 것 같아요',
            '한 번 더 확인해주세요.',
          );
          return;
        }

        const nextNumber =
          (parseInt(number, 10) || 0) + storeConfig.stampsPerCoupon;

        setNumber(nextNumber.toString());
        return;
      }
    }
  };

  const phoneNumberLabel = () => {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(
      3,
      7,
    )}-${phoneNumber.slice(7)}`;
  };

  const close = async () => {
    try {
      track(AnalyticsEvent.SESSION_ENDED, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
      });
    } catch (error) {
      console.log('Error logging session close event:', error);
    }
    console.log('close', phoneNumber);
    await updateSession(`session_${storeCode}`, {
      last_used: new Date().toISOString().split('T')[0],
      phone: '',
      mode: 'waiting',
    });

    // updateLogs();
  };

  const onClickCoupon = (typeId: string) => () => {
    const newSelected = {
      ...userContext.selectedCoupon,
      [typeId]: (userContext.selectedCoupon[typeId] ?? 0) + 1,
    };
    const total = Object.values(newSelected).reduce((s, v) => s + v, 0);
    setNumber(total.toString());
    setUserContext({
      ...userContext,
      selectedCoupon: newSelected,
    });
  };

  useFocusEffect(
    useCallback(() => {
      if (!phoneNumber) {
        return;
      }
      const db = getFirestore();
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;

      const setup = async () => {
        const docId = await resolveUserDocId(phoneNumber);
        if (cancelled) return;
        unsubscribe = onSnapshot(doc(db, 'users', docId), docSnap => {
          if (docSnap.exists) {
            const data = docSnap.data();
            console.log('Detail Current data: ', data);
            if (!data) {
              console.log('No data found');
              return;
            }
            const userProfile = normalizeUser(data, storeConfig.couponTypes);
            const {coupons: validCoupons, issuedAt: validIssuedAt} =
              filterExpiredCoupons(
                userProfile.coupons,
                userProfile.couponIssuedAt,
                storeConfig.couponExpiryDays,
              );
            const filtered = {
              ...userProfile,
              coupons: validCoupons,
              couponIssuedAt: validIssuedAt,
            };
            setUser(filtered);
            setUserContext(
              makeUserContext(filtered.coupons, storeConfig.couponTypes),
            );
          }
        });
      };

      setup();

      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    }, [phoneNumber]),
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.color.surface.normal.bg1}
        translucent={false}
      />
      <SafeAreaView style={styles.backgroundStyle}>
        <View style={styles.innerContainer}>
          <View
            style={[
              styles.flexRowBox,
              {
                backgroundColor: theme.color.surface.normal.bg1,
                // shadow
                shadowColor: theme.color.etc.absolute.black,
                shadowOffset: {
                  width: 0,
                  height: 6,
                },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 10,
                borderRadius: 35,
                paddingVertical: isCompact ? 48 : 0,
                paddingHorizontal: isCompact ? 24 : 0,
              },
            ]}>
            <Pressable
              onPress={close}
              style={[
                styles.flexBox,
                {gap: 4, position: 'absolute', top: isCompact ? 24 : 32, right: isCompact ? 24 : 32, zIndex: 10},
              ]}>
              <Text
                style={{
                  fontSize: isCompact ? 14 : 20,
                  fontFamily: theme.font.regular,
                  color: theme.color.texticon.onNormal.highemp,
                  lineHeight: isCompact ? 20 : 28,
                }}>
                닫기
              </Text>
              <NewXIcon width={isCompact ? 16 : 20} height={isCompact ? 16 : 20} />
            </Pressable>
            <ScrollView
              // 스크롤 할 때 스크롤바가 보이지 않도록 설정
              showsVerticalScrollIndicator={false}
              style={{flex: 1}}
              contentContainerStyle={[
                {
                  display: 'flex',
                  flexDirection: isCompact ? 'column' : 'row',
                  justifyContent: 'center',
                  alignItems: isCompact ? 'center' : undefined,
                  gap: isCompact ? 16 : 110,
                  paddingBottom: isCompact ? 24 : 0,
                  paddingHorizontal: isCompact ? 4 : 0,
                },
              ]}>
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    width: isCompact ? '100%' : 320,
                    height: 'auto',
                    gap: isCompact ? 6 : 10,
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    paddingTop: isCompact ? 8 : 54,
                  },
                ]}>
                <Text style={[styles.labelSubText, isCompact && {fontSize: 14, lineHeight: 20}]}>
                  {`고객번호: `}
                  <Text
                    style={[
                      styles.labelSubText,
                      {
                        color: theme.color.texticon.onNormal.primary,
                        fontFamily: 'SFUIDisplay-Semibold',
                      },
                      isCompact && {fontSize: 14, lineHeight: 20},
                    ]}>
                    {phoneNumberLabel()}
                  </Text>
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: theme.color.surface.normal.container10,
                    borderRadius: isCompact ? 10 : 14,
                    padding: isCompact ? 3 : 4,
                    alignSelf: 'stretch',
                    marginBottom: isCompact ? 2 : 4,
                  }}>
                  <Pressable
                    onPress={() => switchMode('earn')}
                    style={{
                      flex: 1,
                      paddingVertical: isCompact ? 7 : 10,
                      borderRadius: isCompact ? 8 : 11,
                      backgroundColor:
                        mode === 'earn' ? theme.color.surface.normal.bg1 : 'transparent',
                      shadowColor: mode === 'earn' ? theme.color.etc.absolute.black : 'transparent',
                      shadowOffset: {width: 0, height: 1},
                      shadowOpacity: mode === 'earn' ? 0.1 : 0,
                      shadowRadius: 3,
                      elevation: mode === 'earn' ? 2 : 0,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: isCompact ? 14 : 18,
                        fontFamily:
                          mode === 'earn'
                            ? theme.font.bold
                            : theme.font.medium,
                        color: mode === 'earn' ? theme.color.texticon.onNormal.highestemp : theme.color.texticon.onNormal.midemp,
                        letterSpacing: -0.2,
                      }}>
                      적립
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => switchMode('use')}
                    style={{
                      flex: 1,
                      paddingVertical: isCompact ? 7 : 10,
                      borderRadius: isCompact ? 8 : 11,
                      backgroundColor:
                        mode === 'use' ? theme.color.surface.normal.bg1 : 'transparent',
                      shadowColor: mode === 'use' ? theme.color.etc.absolute.black : 'transparent',
                      shadowOffset: {width: 0, height: 1},
                      shadowOpacity: mode === 'use' ? 0.1 : 0,
                      shadowRadius: 3,
                      elevation: mode === 'use' ? 2 : 0,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: isCompact ? 14 : 18,
                        fontFamily:
                          mode === 'use'
                            ? theme.font.bold
                            : theme.font.medium,
                        color: mode === 'use' ? theme.color.texticon.onNormal.highestemp : theme.color.texticon.onNormal.midemp,
                        letterSpacing: -0.2,
                      }}>
                      사용
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.labelBox}>
                  <Text style={[styles.labelTitleText, isCompact && {fontSize: 20, lineHeight: 28}]}>
                    {mode === 'earn'
                      ? isPointMode
                        ? '적립할 포인트를'
                        : '적립할 스탬프 개수를'
                      : isPointMode
                      ? '사용할 포인트를'
                      : '사용할 쿠폰을'}
                  </Text>
                  <Text style={[styles.labelTitleText, isCompact && {fontSize: 20, lineHeight: 28}]}>
                    {mode === 'earn'
                      ? '입력해주세요'
                      : isPointMode
                      ? '입력해주세요'
                      : '선택해주세요'}
                  </Text>
                </View>
                {mode === 'use' && !isPointMode && (
                  <View style={styles.beverageWrapper}>
                    {storeConfig.couponTypes.map(ct => {
                      const remaining =
                        (userContext.possibleCoupons[ct.id] ?? 0) -
                        (userContext.selectedCoupon[ct.id] ?? 0);
                      if (remaining <= 0) return null;
                      return (
                        <View key={ct.id} style={styles.beverageBox}>
                          <View>
                            <Text style={styles.beverageTitleText}>
                              {ct.name} {remaining}장
                            </Text>
                            <Text style={styles.beverageBodyText}>
                              무료 사용가능
                            </Text>
                          </View>
                          <Pressable onPress={onClickCoupon(ct.id)}>
                            <Text style={styles.beverageButtonText}>선택</Text>
                          </Pressable>
                          {remaining > 1 && (
                            <View style={styles.countBadge}>
                              <LinearGradient
                                colors={[theme.color.surface.brand.primary, theme.palette.blue[600]]}
                                locations={[0.4, 1]}
                                start={{x: 0, y: 1}}
                                end={{x: 1, y: 1}}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  flexDirection: 'row',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  gap: 4,
                                  borderRadius: 20,
                                }}>
                                <Text style={styles.badgeText}>
                                  {remaining}
                                </Text>
                              </LinearGradient>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
                {isPointMode &&
                  mode === 'earn' &&
                  storeConfig.pointPresets.length > 0 && (
                    <View style={styles.beverageWrapper}>
                      <Text style={styles.beverageBodyText}>빠른 적립</Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 10,
                          width: '100%',
                        }}>
                        {storeConfig.pointPresets.map(preset => (
                          <Pressable
                            key={preset.id}
                            onPress={() => setNumber(String(preset.points))}
                            style={({pressed}) => ({
                              backgroundColor:
                                number === String(preset.points)
                                  ? theme.color.texticon.onNormal.primary
                                  : pressed
                                  ? theme.palette.gray[200]
                                  : theme.color.surface.normal.container10,
                              paddingHorizontal: 20,
                              paddingVertical: 14,
                              borderRadius: 14,
                              minWidth: 100,
                              alignItems: 'center',
                            })}>
                            <Text
                              style={{
                                fontSize: 16,
                                fontFamily: theme.font.semibold,
                                color:
                                  number === String(preset.points)
                                    ? theme.color.surface.normal.bg1
                                    : theme.color.texticon.onNormal.highestemp,
                                letterSpacing: -0.2,
                              }}>
                              {preset.name}
                            </Text>
                            <Text
                              style={{
                                fontSize: 14,
                                fontFamily: theme.font.regular,
                                color:
                                  number === String(preset.points)
                                    ? 'rgba(255,255,255,0.8)'
                                    : theme.color.texticon.onNormal.midemp,
                                marginTop: 2,
                              }}>
                              {preset.points.toLocaleString()}
                              {storeConfig.pointUnit}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
              </View>
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    paddingLeft: isCompact ? 10 : 15,
                    paddingRight: isCompact ? 10 : 15,
                    borderRadius: isCompact ? 24 : 35,
                    width: '100%',
                    maxWidth: isCompact ? 340 : 420,
                    height: 'auto',
                    backgroundColor: theme.color.surface.normal.bg1,
                  },
                ]}>
                <View
                  style={[
                    styles.flexColumnBox,
                    {
                      width: '100%',
                      maxWidth: isCompact ? 280 : 320,
                      height: 'auto',
                    },
                  ]}>
                  <View
                    style={[
                      styles.subLabelBox,
                      {
                        width: '100%',
                        gap: isCompact ? 40 : 120,
                        marginBottom: isCompact ? 4 : 9,
                        justifyContent: 'flex-end',
                        paddingRight: isCompact ? 4 : 9,
                      },
                    ]}>
                    <Text
                      style={{
                        fontFamily: 'Prentendard-Semibold',
                        color: theme.color.texticon.onNormal.highemp,
                        fontSize: isCompact ? 13 : 16,
                        lineHeight: isCompact ? 20 : 26,
                        letterSpacing: -0.2,
                      }}>
                      {isPointMode ? '현재 보유 포인트' : '현재 보유 스탬프'}
                    </Text>
                    <Text
                      style={{
                        fontSize: isCompact ? 18 : 24,
                        lineHeight: isCompact ? 26 : 32,
                        fontFamily: 'Prentendard-Semibold',
                        color: theme.color.texticon.onNormal.primary,
                      }}>
                      {isPointMode
                        ? `${user.stamps.toLocaleString()}${
                            storeConfig.pointUnit
                          }`
                        : `${user.stamps % storeConfig.stampsPerCoupon}/${
                            storeConfig.stampsPerCoupon
                          }개`}
                    </Text>
                  </View>
                  <View
                    style={[
                      {
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        gap: 10,
                        marginBottom: 20,
                        paddingLeft: 9,
                        paddingRight: 9,
                      },
                    ]}>
                    <View
                      style={[
                        styles.headerNumberContainer,
                        {
                          width: '100%',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: isCompact ? 4 : 8,
                        },
                      ]}>
                      <View style={styles.headerNumberContainer}>
                        {mode === 'use' &&
                          !isPointMode &&
                          totalSelected(userContext.selectedCoupon) > 0 && (
                            <Text
                              style={{
                                color: theme.color.texticon.onNormal.success,
                              }}>
                              {storeConfig.couponTypes
                                .filter(
                                  ct =>
                                    (userContext.selectedCoupon[ct.id] ?? 0) >
                                    0,
                                )
                                .map(
                                  ct =>
                                    `${ct.name} ${
                                      userContext.selectedCoupon[ct.id]
                                    }장`,
                                )
                                .join(', ')}
                            </Text>
                          )}
                        <Text
                          style={[
                            styles.headerNumberText,
                            {
                              fontSize: isCompact ? 28 : 38,
                              lineHeight: isCompact ? 36 : 48,
                              color: number.length > 0 ? theme.color.texticon.onNormal.highestemp : theme.palette.gray[200],
                            },
                          ]}>
                          {number || '0'}
                        </Text>
                        <Text
                          style={[
                            styles.headerNumberText,
                            {
                              fontFamily: theme.font.semibold,
                            },
                          ]}>
                          {isPointMode
                            ? storeConfig.pointUnit
                            : mode === 'use'
                            ? '장'
                            : '개'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.divisor}></View>
                  </View>
                  <View
                    pointerEvents={
                      mode === 'use' && !isPointMode ? 'none' : 'auto'
                    }
                    style={[
                      {
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        gap: isCompact ? 6 : 12,
                        opacity: mode === 'use' && !isPointMode ? 0.25 : 1,
                      },
                    ]}>
                    {NUMBER_SEQUENCE.map((row, rowIndex) => (
                      <View key={rowIndex} style={[styles.numberInputContainer, isCompact && {gap: 8}]}>
                        {row.map((number, numberIndex) => (
                          <Pressable
                            key={numberIndex}
                            style={({pressed}) => [
                              {
                                backgroundColor: pressed ? theme.color.surface.normal.container10 : theme.color.surface.normal.bg1,
                                borderRadius: 10,
                              },
                              styles.numberInputButton,
                              isCompact && {width: 64, height: 44},
                            ]}
                            onPress={() => onNumberPress(number)}>
                            <Text style={[styles.numberInputText, isCompact && {fontSize: 26}]}>{number}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ))}
                    <View style={[styles.numberInputContainer, isCompact && {gap: 8}]}>
                      <Pressable style={[styles.numberInputButton, isCompact && {width: 64, height: 44}]}></Pressable>
                      <Pressable
                        style={({pressed}) => [
                          {
                            backgroundColor: pressed ? theme.color.surface.normal.container10 : theme.color.surface.normal.bg1,
                            borderRadius: 10,
                          },
                          styles.numberInputButton,
                          isCompact && {width: 64, height: 44},
                        ]}
                        onPress={() => onNumberPress(0)}>
                        <Text style={[styles.numberInputText, isCompact && {fontSize: 26}]}>0</Text>
                      </Pressable>
                      <Pressable
                        style={({pressed}) => [
                          {
                            backgroundColor: pressed ? theme.color.surface.normal.container10 : theme.color.surface.normal.bg1,
                            borderRadius: 10,
                          },
                          styles.numberInputButton,
                          isCompact && {width: 64, height: 44},
                        ]}
                        onPress={() => onNumberPress('c')}>
                        <LeftArrowIcon />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.confirmContainer}>
                    {mode === 'use' ? (
                      <>
                        {!isPointMode && (
                          <Pressable
                            style={({pressed}) => [
                              styles.confirmButton,
                              {
                                width: pressed ? 142 : 150,
                                backgroundColor: theme.palette.gray[200],
                                shadowColor: theme.palette.gray[200],
                                gap: 6,
                              },
                            ]}
                            onPress={refresh}>
                            <RefreshIcon />
                            <Text
                              style={[
                                styles.confirmButtonText,
                                {
                                  color: theme.color.texticon.onNormal.highestemp,
                                },
                              ]}>
                              입력 초기화
                            </Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={({pressed}) => [
                            styles.confirmButton,
                            {
                              width: isPointMode
                                ? pressed
                                  ? '98%'
                                  : '100%'
                                : pressed
                                ? 142
                                : 150,
                              backgroundColor: theme.color.surface.brand.primary,
                              shadowColor: theme.color.surface.brand.primary,
                            },
                          ]}
                          onPress={
                            isPointMode ? handleUsingPoint : handleUsing
                          }>
                          <LinearGradient
                            colors={[theme.color.surface.brand.primary, theme.palette.blue[700]]}
                            locations={[0.3, 1]}
                            start={{x: 0, y: 0}}
                            end={{x: 1, y: 1}}
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 4,
                              borderRadius: 20,
                            }}>
                            <CircleMinusIcon />
                            <Text style={styles.confirmButtonText}>
                              사용하기
                            </Text>
                          </LinearGradient>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        style={({pressed}) => [
                          styles.confirmButton,
                          {
                            width: pressed ? '98%' : '100%',
                            backgroundColor: theme.palette.green[500],
                            shadowColor: theme.palette.green[500],
                          },
                        ]}
                        onPress={
                          isPointMode ? handleApprovePoint : handleApprove
                        }>
                        <LinearGradient
                          colors={[theme.palette.green[500], theme.palette.green[700]]}
                          locations={[0.3, 1]}
                          start={{x: 0, y: 0}}
                          end={{x: 1, y: 1}}
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 4,
                            borderRadius: 20,
                          }}>
                          <CirclePlusIcon />
                          <Text style={styles.confirmButtonText}>적립하기</Text>
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>

                  <View
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      marginTop: 8,
                      height: 26,
                    }}>
                    {mode === 'earn' ? (
                      <Text style={styles.beverageBodyText}>
                        {isPointMode
                          ? `적립 후 포인트: ${(
                              user.stamps + (parseInt(number, 10) || 0)
                            ).toLocaleString()}${storeConfig.pointUnit}`
                          : `적립 후 스탬프: ${
                              (user.stamps + (parseInt(number, 10) || 0)) %
                              storeConfig.stampsPerCoupon
                            }/${storeConfig.stampsPerCoupon}개`}
                      </Text>
                    ) : (
                      <Text style={styles.beverageBodyText}>
                        {isPointMode
                          ? (parseInt(number, 10) || 0) > 0
                            ? `${(parseInt(number, 10) || 0).toLocaleString()}${
                                storeConfig.pointUnit
                              } 사용 예정`
                            : '사용할 포인트를 입력해주세요'
                          : totalSelected(userContext.selectedCoupon) > 0
                          ? `쿠폰 ${totalSelected(
                              userContext.selectedCoupon,
                            )}장 사용 예정`
                          : '쿠폰을 선택해주세요'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundStyle: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  flexColumnBox: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexCenterBox: {
    flexDirection: 'row',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  contentsText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  flexRowBox: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listBox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  button: {
    flex: 1,
    height: 50,
    backgroundColor: theme.color.surface.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  buttonText: {
    color: theme.color.etc.absolute.white,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    height: 'auto',
    width: 'auto',
    backgroundColor: theme.color.surface.normal.bg1,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: theme.color.etc.absolute.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonClose: {
    backgroundColor: theme.color.surface.brand.primary,
    height: 50,
    width: 120,
    borderRadius: 10,
    elevation: 2,
    justifyContent: 'center',
  },
  counterText: {
    color: theme.color.etc.absolute.white,
    fontSize: 24,
    fontFamily: theme.font.regular,
    lineHeight: 24,
    textAlign: 'center',
  },
  counterInnerText: {
    fontSize: 18,
    fontFamily: theme.font.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
  textStyle: {
    color: theme.color.etc.absolute.white,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
  },
  labelBox: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  subLabelBox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  labelTitleText: {
    fontSize: 32,
    fontFamily: theme.font.medium,
    lineHeight: 45,
    letterSpacing: -0.2,
  },
  labelSubText: {
    fontSize: 20,
    fontFamily: theme.font.regular,
    lineHeight: 28,
    letterSpacing: -0.1,
  },
  numberInputContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  numberInputButton: {
    display: 'flex',
    width: 84,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberInputText: {
    fontSize: 38,
    color: theme.color.texticon.onNormal.highemp,
    fontFamily: 'SFUIDisplay-Semibold',
  },
  headerNumberContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  headerNumberText: {
    fontSize: 32,
    color: theme.color.texticon.onNormal.highestemp,
    fontFamily: 'SFUIDisplay-Semibold',
    lineHeight: 45,
  },
  divisor: {
    width: '100%',
    height: 0.5,
    backgroundColor: theme.palette.gray[200],
  },
  confirmContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  confirmButton: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
    backgroundColor: theme.color.surface.brand.primary,
    borderRadius: 24,
    // shadow
    shadowColor: theme.color.surface.brand.primary,
    shadowOffset: {
      width: 0,
      height: 4.5,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmButtonText: {
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.1,
    color: theme.color.etc.absolute.white,
    fontFamily: theme.font.regular,
  },
  flexBox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  beverageWrapper: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 40,
  },
  beverageBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.color.surface.normal.container10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beverageTitleText: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: theme.font.medium,
    color: theme.color.texticon.onNormal.highestemp,
    letterSpacing: -0.1,
  },
  beverageBodyText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: theme.font.regular,
    color: theme.color.texticon.onNormal.highestemp,
    letterSpacing: -0.2,
  },
  beverageButtonText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: theme.font.medium,
    color: theme.color.texticon.onNormal.highestemp,
    letterSpacing: -0.2,
    textDecorationLine: 'underline',
  },
  countBadge: {
    position: 'absolute',
    right: -8,
    top: -10,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
    padding: 2,
    backgroundColor: theme.color.surface.normal.bg1,
    borderRadius: 14,
    shadowColor: theme.color.surface.brand.primary,
    shadowOffset: {
      width: 0,
      height: 4.5,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  badgeText: {
    color: theme.color.etc.absolute.white,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.1,
    fontFamily: 'SFUIDisplay-Semibold',
  },
});

export default DetailView;
