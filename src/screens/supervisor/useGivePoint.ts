import {useCallback, useState} from 'react';
import {Alert} from 'react-native';
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
import {confirm} from '../../utils/alert';
import {
  normalizeUser,
  makeUserContext,
  totalSelected,
  addCouponTimestamp,
  removeCouponTimestamps,
  filterExpiredCoupons,
} from '../../utils/coupons';

export type GiveMode = 'earn' | 'use';

export type GivePointOptions = {
  /**
   * 관리자가 고객 검색으로 직접 연 흐름인지 여부.
   * true면 close()가 고객 태블릿 세션을 건드리지 않는다 —
   * 수동 적립 때문에 대기 중인 고객 화면이 초기화되면 안 되므로.
   */
  manual?: boolean;
};

/**
 * 적립/사용 행위의 순수 비즈니스 로직 (UI 없음).
 * 태블릿 풀모달(DetailView)과 모바일 바텀시트(GivePointSheet)가 공유 —
 * 포인트/스탬프 계산·쿠폰 발급·파이어스토어 기록·애널리틱스를 단일 소스로 유지.
 */
export function useGivePoint(
  phoneNumber: string,
  updateLogs: () => void,
  options: GivePointOptions = {},
) {
  const {manual = false} = options;
  const {storeCode} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const {track} = useAnalytics();
  const {updateUser, updateSession, addLog, resolveUserDocId} =
    useFirestore(storeCode);

  const isPointMode = storeConfig.mode === 'point';

  const [mode, setMode] = useState<GiveMode>('earn');
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

  const handleApprovePoint = async (): Promise<boolean> => {
    if (number.length === 0) {
      Alert.alert('적립할 포인트를 입력해주세요', '다시 입력해주세요.');
      return false;
    }
    const pointValue = parseInt(number, 10);
    if (isNaN(pointValue) || pointValue < 1) {
      Alert.alert('적립할 포인트를 1 이상 입력해주세요', '다시 입력해주세요.');
      return false;
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
    return true;
  };

  const handleUsingPoint = async (): Promise<boolean> => {
    const pointsToUse = parseInt(number, 10);
    if (isNaN(pointsToUse) || pointsToUse < 1) {
      Alert.alert('사용할 포인트를 입력해주세요', '다시 입력해주세요.');
      return false;
    }
    if (pointsToUse > user.stamps) {
      Alert.alert('포인트 부족', '보유 포인트보다 많이 사용할 수 없습니다.');
      return false;
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
    return true;
  };

  const handleApprove = async (): Promise<boolean> => {
    if (number.length === 0) {
      Alert.alert('적립할 스탬프를 입력해주세요', '다시 입력해주세요.');
      return false;
    }

    const numberValue = parseInt(number, 10);

    if (numberValue < 1) {
      Alert.alert('적립할 스탬프를 1개 이상 입력해주세요', '다시 입력해주세요.');
      return false;
    }

    if (numberValue > 100) {
      Alert.alert(
        '적립하는 쿠폰의 수가 많은 것 같아요',
        '한 번 더 확인해주세요.',
      );
      return false;
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
      coupons,
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
    updateLogs();
    return true;
  };

  const handleUsing = async (): Promise<boolean> => {
    const selected = totalSelected(userContext.selectedCoupon);
    if (selected < 1) {
      Alert.alert('사용할 쿠폰을 선택해주세요', '쿠폰을 눌러 선택해주세요.');
      return false;
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
      coupons: remainingCoupons,
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
    return true;
  };

  const switchMode = (newMode: GiveMode) => {
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
    const result = await confirm('쿠폰 입력 확인', '쿠폰을 초기화하시겠어요?');
    if (!result) {
      return;
    }

    setNumber('');
    setUserContext(makeUserContext(user.coupons, storeConfig.couponTypes));
  };

  const onNumberPress = (value: number | string) => {
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

  const phoneNumberLabel = () =>
    `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(
      7,
    )}`;

  const close = async () => {
    try {
      track(AnalyticsEvent.SESSION_ENDED, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
      });
    } catch (error) {
      console.log('Error logging session close event:', error);
    }
    // 수동 모드에선 고객 태블릿 세션이 이 흐름의 주인이 아니다.
    // 여기서 세션을 리셋하면 대기 중인 고객 화면을 빼앗게 되므로 건너뛴다.
    if (manual) return;
    await updateSession(`session_${storeCode}`, {
      last_used: new Date().toISOString().split('T')[0],
      phone: '',
      mode: 'waiting',
    });
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

  // 바텀시트 쿠폰 스테퍼(+/−). 보유 개수 내에서 클램프.
  const adjustCoupon = (typeId: string, delta: number) => {
    const max = userContext.possibleCoupons[typeId] ?? 0;
    const cur = userContext.selectedCoupon[typeId] ?? 0;
    const next = Math.min(Math.max(cur + delta, 0), max);
    const newSelected = {...userContext.selectedCoupon, [typeId]: next};
    const total = Object.values(newSelected).reduce((s, v) => s + v, 0);
    setNumber(total.toString());
    setUserContext({...userContext, selectedCoupon: newSelected});
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
            if (!data) {
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
      // storeConfig도 의존: config는 비동기 로드되므로, 로드 전 구독이 걸리면
      // normalizeUser가 DEFAULT couponTypes로 쿠폰 키를 잘못 매핑한다.
      // config 도착 시 재구독해 올바른 couponTypes로 다시 정규화한다.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phoneNumber, storeConfig]),
  );

  return {
    storeConfig,
    isPointMode,
    manual,
    mode,
    number,
    user,
    userContext,
    setNumber,
    switchMode,
    refresh,
    onNumberPress,
    onClickCoupon,
    adjustCoupon,
    phoneNumberLabel,
    close,
    handleApprove,
    handleApprovePoint,
    handleUsing,
    handleUsingPoint,
  };
}
