import React, {useCallback, useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Alert,
  useWindowDimensions,
} from 'react-native';
import {useAuth, useFirestore, useAnalytics, useStoreConfig} from '../../hooks';
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
  const {width: screenWidth} = useWindowDimensions();
  const isCompact = screenWidth < 768;
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
    for (let index = 0; index < difference; index++) {
      const currentIdx = seq.indexOf(phase);
      coupons[phase] = (coupons[phase] ?? 0) + 1;
      if (phase === storeConfig.levelIncrementOn) {
        level += 1;
      }
      phase = seq[(currentIdx + 1) % seq.length];
    }

    const updateContext = {
      stamps: stampsTotal,
      phase,
      ...flattenCouponsForFirestore(coupons, storeConfig.couponTypes),
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
    await updateUser(phoneNumber, {
      ...flattenCouponsForFirestore(remainingCoupons, storeConfig.couponTypes),
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
      if (number.length > 3) {
        Alert.alert(
          '적립하는 스탬프의 수가 많은 것 같아요',
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
        if (number.length > 3) {
          Alert.alert(
            '적립하는 스탬프의 수가 많은 것 같아요',
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
            setUser(userProfile);
            setUserContext(
              makeUserContext(userProfile.coupons, storeConfig.couponTypes),
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
        backgroundColor="#6a51ae"
        translucent={false}
      />
      <SafeAreaView style={styles.backgroundStyle}>
        <View style={styles.innerContainer}>
          <View
            style={[
              styles.flexRowBox,
              {
                backgroundColor: '#ffffff',
                // shadow
                shadowColor: '#000',
                shadowOffset: {
                  width: 0,
                  height: 6,
                },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 10,
                borderRadius: 35,
              },
            ]}>
            <Pressable
              onPress={close}
              style={[
                styles.flexBox,
                {gap: 6, position: 'absolute', top: 32, right: 32},
              ]}>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Pretendard-Regular',
                  color: '#4E5056',
                  lineHeight: 28,
                }}>
                닫기
              </Text>
              <NewXIcon width={20} height={20} />
            </Pressable>
            <ScrollView
              contentContainerStyle={[
                {
                  display: 'flex',
                  flexDirection: isCompact ? 'column' : 'row',
                  justifyContent: 'center',
                  alignItems: isCompact ? 'center' : undefined,
                  gap: isCompact ? 24 : 110,
                  paddingBottom: isCompact ? 40 : 0,
                },
              ]}>
              <View
                style={[
                  styles.flexColumnBox,
                  {
                    width: isCompact ? '100%' : 320,
                    height: 'auto',
                    gap: 10,
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    paddingTop: isCompact ? 16 : 54,
                  },
                ]}>
                <Text style={styles.labelSubText}>
                  {`고객번호: `}
                  <Text
                    style={[
                      styles.labelSubText,
                      {
                        color: '#FE7901',
                        fontFamily: 'SFUIDisplay-Semibold',
                      },
                    ]}>
                    {phoneNumberLabel()}
                  </Text>
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: '#F0F0F0',
                    borderRadius: 14,
                    padding: 4,
                    alignSelf: 'stretch',
                    marginBottom: 4,
                  }}>
                  <Pressable
                    onPress={() => switchMode('earn')}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 11,
                      backgroundColor:
                        mode === 'earn' ? '#FFFFFF' : 'transparent',
                      shadowColor: mode === 'earn' ? '#000' : 'transparent',
                      shadowOffset: {width: 0, height: 1},
                      shadowOpacity: mode === 'earn' ? 0.1 : 0,
                      shadowRadius: 3,
                      elevation: mode === 'earn' ? 2 : 0,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontFamily:
                          mode === 'earn'
                            ? 'Pretendard-Bold'
                            : 'Pretendard-Medium',
                        color: mode === 'earn' ? '#191D2B' : '#999',
                        letterSpacing: -0.2,
                      }}>
                      적립
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => switchMode('use')}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 11,
                      backgroundColor:
                        mode === 'use' ? '#FFFFFF' : 'transparent',
                      shadowColor: mode === 'use' ? '#000' : 'transparent',
                      shadowOffset: {width: 0, height: 1},
                      shadowOpacity: mode === 'use' ? 0.1 : 0,
                      shadowRadius: 3,
                      elevation: mode === 'use' ? 2 : 0,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontFamily:
                          mode === 'use'
                            ? 'Pretendard-Bold'
                            : 'Pretendard-Medium',
                        color: mode === 'use' ? '#191D2B' : '#999',
                        letterSpacing: -0.2,
                      }}>
                      사용
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.labelBox}>
                  <Text style={styles.labelTitleText}>
                    {mode === 'earn'
                      ? isPointMode ? '적립할 포인트를' : '적립할 스탬프 개수를'
                      : isPointMode ? '사용할 포인트를' : '사용할 쿠폰을'}
                  </Text>
                  <Text style={styles.labelTitleText}>
                    {mode === 'earn' ? '입력해주세요' : isPointMode ? '입력해주세요' : '선택해주세요'}
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
                            <Text style={styles.beverageButtonText}>
                              선택
                            </Text>
                          </Pressable>
                          {remaining > 1 && (
                            <View style={styles.countBadge}>
                              <LinearGradient
                                colors={['#FE8300', '#FC4A00']}
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
                {isPointMode && mode === 'earn' && storeConfig.pointPresets.length > 0 && (
                  <View style={styles.beverageWrapper}>
                    <Text style={styles.beverageBodyText}>빠른 적립</Text>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%'}}>
                      {storeConfig.pointPresets.map(preset => (
                        <Pressable
                          key={preset.id}
                          onPress={() => setNumber(String(preset.points))}
                          style={({pressed}) => ({
                            backgroundColor: number === String(preset.points) ? '#FE7901' : pressed ? '#E8E8E8' : '#F5F5F5',
                            paddingHorizontal: 20,
                            paddingVertical: 14,
                            borderRadius: 14,
                            minWidth: 100,
                            alignItems: 'center',
                          })}>
                          <Text style={{
                            fontSize: 16,
                            fontFamily: 'Pretendard-SemiBold',
                            color: number === String(preset.points) ? '#FFFFFF' : '#191D2B',
                            letterSpacing: -0.2,
                          }}>
                            {preset.name}
                          </Text>
                          <Text style={{
                            fontSize: 14,
                            fontFamily: 'Pretendard-Regular',
                            color: number === String(preset.points) ? 'rgba(255,255,255,0.8)' : '#999',
                            marginTop: 2,
                          }}>
                            {preset.points.toLocaleString()}{storeConfig.pointUnit}
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
                    paddingLeft: 15,
                    paddingRight: 15,
                    borderRadius: 35,
                    width: '100%',
                    maxWidth: 420,
                    height: 'auto',
                    backgroundColor: '#ffffff',
                  },
                ]}>
                <View
                  style={[
                    styles.flexColumnBox,
                    {
                      width: '100%',
                      maxWidth: 320,
                      height: 'auto',
                    },
                  ]}>
                  <View
                    style={[
                      styles.subLabelBox,
                      {
                        width: '100%',
                        gap: 120,
                        marginBottom: 9,
                        justifyContent: 'flex-end',
                        paddingRight: 9,
                      },
                    ]}>
                    <Text
                      style={{
                        fontFamily: 'Prentendard-Semibold',
                        color: '#4E5056',
                        fontSize: 16,
                        lineHeight: 26,
                        letterSpacing: -0.2,
                      }}>
                      {isPointMode ? '현재 보유 포인트' : '현재 보유 스탬프'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 24,
                        lineHeight: 32,
                        fontFamily: 'Prentendard-Semibold',
                        color: '#FE7901',
                      }}>
                      {isPointMode
                        ? `${user.stamps.toLocaleString()}${storeConfig.pointUnit}`
                        : `${user.stamps % storeConfig.stampsPerCoupon}/${storeConfig.stampsPerCoupon}개`}
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
                        },
                      ]}>
                      <View style={styles.headerNumberContainer}>
                        {mode === 'use' && !isPointMode &&
                          totalSelected(userContext.selectedCoupon) > 0 && (
                            <Text
                              style={{
                                color: '#FF8400',
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
                              fontSize: 38,
                              lineHeight: 48,
                              color: number.length > 0 ? '#191D2B' : '#E3E3E3',
                            },
                          ]}>
                          {number || '0'}
                        </Text>
                        <Text
                          style={[
                            styles.headerNumberText,
                            {
                              fontFamily: 'Pretendard-Semibold',
                            },
                          ]}>
                          {isPointMode ? storeConfig.pointUnit : mode === 'use' ? '장' : '개'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.divisor}></View>
                  </View>
                  <View
                    pointerEvents={mode === 'use' && !isPointMode ? 'none' : 'auto'}
                    style={[
                      {
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        gap: 12,
                        opacity: mode === 'use' && !isPointMode ? 0.25 : 1,
                      },
                    ]}>
                    {NUMBER_SEQUENCE.map((row, rowIndex) => (
                      <View key={rowIndex} style={styles.numberInputContainer}>
                        {row.map((number, numberIndex) => (
                          <Pressable
                            key={numberIndex}
                            style={({pressed}) => [
                              {
                                backgroundColor: pressed ? '#EEEEEE' : '#fff',
                                borderRadius: 10,
                              },
                              styles.numberInputButton,
                            ]}
                            onPress={() => onNumberPress(number)}>
                            <Text style={styles.numberInputText}>{number}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ))}
                    <View style={styles.numberInputContainer}>
                      <Pressable style={styles.numberInputButton}></Pressable>
                      <Pressable
                        style={({pressed}) => [
                          {
                            backgroundColor: pressed ? '#EEEEEE' : '#fff',
                            borderRadius: 10,
                          },
                          styles.numberInputButton,
                        ]}
                        onPress={() => onNumberPress(0)}>
                        <Text style={styles.numberInputText}>0</Text>
                      </Pressable>
                      <Pressable
                        style={({pressed}) => [
                          {
                            backgroundColor: pressed ? '#EEEEEE' : '#fff',
                            borderRadius: 10,
                          },
                          styles.numberInputButton,
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
                              backgroundColor: '#EDEDED',
                              shadowColor: '#EDEDED',
                              gap: 6,
                            },
                          ]}
                          onPress={refresh}>
                          <RefreshIcon />
                          <Text
                            style={[
                              styles.confirmButtonText,
                              {
                                color: '#373737',
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
                              width: isPointMode ? (pressed ? '98%' : '100%') : (pressed ? 142 : 150),
                              backgroundColor: '#0090FE',
                              shadowColor: '#0090FE',
                            },
                          ]}
                          onPress={isPointMode ? handleUsingPoint : handleUsing}>
                          <LinearGradient
                            colors={['#0090FE', '#003FFC']}
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
                            backgroundColor: '#FE6A00',
                            shadowColor: '#FE6A00',
                          },
                        ]}
                        onPress={isPointMode ? handleApprovePoint : handleApprove}>
                        <LinearGradient
                          colors={['#FE6A00', '#FC0000']}
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
                          ? `적립 후 포인트: ${(user.stamps + (parseInt(number, 10) || 0)).toLocaleString()}${storeConfig.pointUnit}`
                          : `적립 후 스탬프: ${(user.stamps + (parseInt(number, 10) || 0)) % storeConfig.stampsPerCoupon}/${storeConfig.stampsPerCoupon}개`}
                      </Text>
                    ) : (
                      <Text style={styles.beverageBodyText}>
                        {isPointMode
                          ? (parseInt(number, 10) || 0) > 0
                            ? `${(parseInt(number, 10) || 0).toLocaleString()}${storeConfig.pointUnit} 사용 예정`
                            : '사용할 포인트를 입력해주세요'
                          : totalSelected(userContext.selectedCoupon) > 0
                            ? `쿠폰 ${totalSelected(userContext.selectedCoupon)}장 사용 예정`
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

const styles = StyleSheet.create({
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
    backgroundColor: '#3D7BF7',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
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
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonClose: {
    backgroundColor: '#2196F3',
    height: 50,
    width: 120,
    borderRadius: 10,
    elevation: 2,
    justifyContent: 'center',
  },
  counterText: {
    color: 'white',
    fontSize: 24,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 24,
    textAlign: 'center',
  },
  counterInnerText: {
    fontSize: 18,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 20,
    textAlign: 'center',
  },
  textStyle: {
    color: 'white',
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
    fontFamily: 'Pretendard-Medium',
    lineHeight: 45,
    letterSpacing: -0.2,
  },
  labelSubText: {
    fontSize: 20,
    fontFamily: 'Pretendard-Regular',
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
    color: '#4B4D55',
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
    color: '#191D2B',
    fontFamily: 'SFUIDisplay-Semibold',
    lineHeight: 45,
  },
  divisor: {
    width: '100%',
    height: 0.5,
    backgroundColor: '#E0E0E9',
  },
  confirmContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    gap: 20,
  },
  confirmButton: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 72,
    backgroundColor: '#FE8300',
    borderRadius: 24,
    // shadow
    shadowColor: '#FE6D00',
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
    color: 'white',
    fontFamily: 'Pretendard-Regular',
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
    backgroundColor: '#F5F5F5',
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
    fontFamily: 'Pretendard-Medium',
    color: '#3A3A3A',
    letterSpacing: -0.1,
  },
  beverageBodyText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: 'Pretendard-Regular',
    color: '#3A3A3A',
    letterSpacing: -0.2,
  },
  beverageButtonText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: 'Pretendard-Medium',
    color: '#3A3A3A',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    shadowColor: '#FE6D00',
    shadowOffset: {
      width: 0,
      height: 4.5,
    },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.1,
    fontFamily: 'SFUIDisplay-Semibold',
  },
});

export default DetailView;
