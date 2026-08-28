import {useCallback, useEffect, useMemo, useState} from 'react';
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
import {
  normalizeUser,
  addCouponTimestamp,
  buildCouponEntries,
  removeCouponEntries,
  filterExpiredCoupons,
} from '../../utils/coupons';
import {pushRecentLog} from '../../utils/recentLogs';

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
  const couponExpiryDays = storeConfig.couponExpiryDays;

  /** 고객이 바뀔 때 되돌아갈 자리. 아직 아무것도 안 읽은 상태다. */
  const blankUser = (): User => ({
    last_used: '',
    level: 0,
    stamps: 0,
    points: 0,
    phase: storeConfig.couponSequence[0] ?? 'americano',
    coupons: {},
    hasRated: false,
  });

  const [mode, setMode] = useState<GiveMode>('earn');
  const [number, setNumber] = useState('');
  const [user, setUser] = useState<User>(blankUser);
  /**
   * 사용하려고 고른 쿠폰 **장**들의 key (CouponEntry.key).
   * 타입별 개수가 아니라 장을 직접 들고 있어야, 체크한 줄과 실제로 차감되는
   * 장의 만료일이 어긋나지 않는다.
   */
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  /**
   * 이 고객의 문서를 실제로 한 번 읽었는가.
   *
   * `user`의 초기값은 blankUser — level 0, coupons {}, stamps 0이다. 그런데
   * 적립·사용 핸들러는 전부 그 값을 **기준으로 새 값을 계산해 통째로 덮어쓴다.**
   * 그래서 문서가 도착하기 전에 적립을 누르면 쿠폰과 레벨이 0으로 밀린다.
   *
   * 창이 좁아 보이지만 그렇지 않다. _resolveUserDoc은 복합 ID를 먼저 조회하고
   * 없으면 레거시(전화번호만) 문서로 폴백하므로, 레거시 고객은 **getDoc 왕복이
   * 2회**다. 카운터 와이파이에서 수 초가 걸리고, 그 사이 한 번 누르면 끝이다.
   * (KB000001에서 실제로 54명이 이렇게 날아갔다 — 레거시 문서가 남아 있는
   *  유일한 매장이라 이 매장만 터졌다)
   *
   * 문서를 못 읽었으면 쓰지 않는다. 어차피 updateDoc은 없는 문서에 실패하므로
   * 여기서 막아도 정상 흐름이 잃는 것은 없다.
   */
  const [loaded, setLoaded] = useState(false);

  /** 아직 못 읽었으면 쓰기를 거부한다. 덮어쓰기보다 한 번 더 누르는 편이 낫다. */
  const guardLoaded = (): boolean => {
    if (loaded) return true;
    Alert.alert(
      '고객 정보를 불러오는 중이에요',
      '잠시 후 다시 눌러주세요.',
    );
    return false;
  };

  /**
   * 고객이 바뀌면 언제나 '적립'부터 다시 시작한다.
   *
   * 모바일 풀스크린(GivePointSheet)은 닫혀 있어도 마운트된 채로 남아서, 비워주지
   * 않으면 앞 고객이 남긴 탭·입력값·선택한 쿠폰·잔액이 다음 고객 화면에 그대로
   * 붙어 나온다 — 한 명 사용 처리하고 다음 손님을 적립하려는데 '사용'이 켜져
   * 있던 현장 제보가 이것이다. 카운터에서 압도적으로 잦은 동작은 적립이고,
   * 남의 잔액이 잠깐이라도 보이면 안 되므로 잔액도 같이 지운다.
   *
   * (태블릿 DetailView는 모달이 닫힐 때 통째로 언마운트돼 원래 초기화됐다.
   *  그래서 모바일 리뉴얼 이후에만 증상이 나타났다)
   */
  useEffect(() => {
    setMode('earn');
    setNumber('');
    setSelectedKeys([]);
    setUser(blankUser());
    setLoaded(false);
    // blankUser는 매 렌더 새 함수 — 고객이 바뀔 때만 돌아야 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber]);

  const handleApprovePoint = async (): Promise<boolean> => {
    if (!guardLoaded()) return false;
    if (number.length === 0) {
      Alert.alert('적립할 포인트를 입력해주세요', '다시 입력해주세요.');
      return false;
    }
    const pointValue = parseInt(number, 10);
    if (isNaN(pointValue) || pointValue < 1) {
      Alert.alert('적립할 포인트를 1 이상 입력해주세요', '다시 입력해주세요.');
      return false;
    }

    // 포인트는 points에만 쌓는다. stamps는 스탬프 모드가 판을 세는 필드라
    // 여기서 건드리면 모드를 바꿨을 때 서로의 값을 덮어쓴다.
    const newPoints = user.points + pointValue;
    await updateUser(phoneNumber, {
      points: newPoints,
      last_used: new Date().toISOString().split('T')[0],
      // 고객 화면 최근내역용. logs는 점주만 읽을 수 있어서 별도로 남긴다.
      recentLogs: pushRecentLog(user.recentLogs, {
        action: 'stamp_saved',
        amount: pointValue,
      }),
    });

    addLog({
      action: 'stamp_saved',
      phone_number: phoneNumber,
      stamp: pointValue,
      timestamp: Timestamp.now(),
      note: `${pointValue.toLocaleString()}${storeConfig.pointUnit} 적립`,
      store_code: storeCode ?? undefined,
      user_level: user.level,
      mode: 'point',
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
        stamps_total: newPoints,
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
    if (!guardLoaded()) return false;
    const pointsToUse = parseInt(number, 10);
    if (isNaN(pointsToUse) || pointsToUse < 1) {
      Alert.alert('사용할 포인트를 입력해주세요', '다시 입력해주세요.');
      return false;
    }
    if (pointsToUse > user.points) {
      Alert.alert('포인트 부족', '보유 포인트보다 많이 사용할 수 없습니다.');
      return false;
    }

    const newPoints = user.points - pointsToUse;
    await updateUser(phoneNumber, {
      points: newPoints,
      last_used: new Date().toISOString().split('T')[0],
      recentLogs: pushRecentLog(user.recentLogs, {
        action: 'stamp_used',
        amount: pointsToUse,
      }),
    });

    addLog({
      action: 'stamp_used',
      phone_number: phoneNumber,
      stamp: pointsToUse,
      timestamp: Timestamp.now(),
      note: `${pointsToUse.toLocaleString()}${storeConfig.pointUnit} 사용`,
      store_code: storeCode ?? undefined,
      user_level: user.level,
      mode: 'point',
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
        stamps_total: newPoints,
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
    if (!guardLoaded()) return false;
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
      recentLogs: pushRecentLog(user.recentLogs, {
        action: 'stamp_saved',
        amount: numberValue,
        ...(difference > 0 ? {note: `쿠폰 ${difference}장 획득`} : {}),
      }),
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
      mode: 'stamp',
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
    if (!guardLoaded()) return false;
    const selected = selectedKeys.length;
    if (selected < 1) {
      Alert.alert('사용할 쿠폰을 선택해주세요', '쿠폰을 눌러 선택해주세요.');
      return false;
    }

    // 쿠폰만 차감 (스탬프 카드 모델: 쿠폰 사용 시 스탬프 변동 없음).
    // 고른 장을 그대로 뺀다 — 오래된 순이 아니라 체크된 장.
    const {
      coupons: remainingCoupons,
      issuedAt: remainingIssuedAt,
      usedByType,
    } = removeCouponEntries(user.coupons, user.couponIssuedAt, selectedKeys);

    const noteString = storeConfig.couponTypes
      .filter(ct => (usedByType[ct.id] ?? 0) > 0)
      .map(ct => `${ct.name} ${usedByType[ct.id]}장`)
      .join(' ');

    await updateUser(phoneNumber, {
      coupons: remainingCoupons,
      couponIssuedAt: remainingIssuedAt,
      recentLogs: pushRecentLog(user.recentLogs, {
        action: 'stamp_used',
        amount: selected,
        note: noteString,
      }),
    });

    addLog({
      action: 'stamp_used',
      phone_number: phoneNumber,
      stamp: 0,
      timestamp: Timestamp.now(),
      note: noteString,
      store_code: storeCode ?? undefined,
      user_level: user.level,
      // 스탬프는 안 줄어드니(stamp: 0) 사용 장수는 여기에 남긴다 — 통계가 읽는다.
      coupons_redeemed: selected,
      mode: 'stamp',
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
        coupons_redeemed: usedByType,
      });
    } catch (error) {
      console.log('Error logging coupon redeemed event:', error);
    }

    setNumber('');
    setSelectedKeys([]);
    updateLogs();
    return true;
  };

  const switchMode = (newMode: GiveMode) => {
    setMode(newMode);
    setNumber('');
    setSelectedKeys([]);
  };

  /** 쿠폰 선택 초기화. 되돌리기 쉬운 조작이라 확인 대화상자는 두지 않는다. */
  const clearSelection = () => {
    try {
      track(AnalyticsEvent.STAMP_RESET, {
        store_code: storeCode,
        user_id: hashPhone(phoneNumber),
      });
    } catch (error) {
      console.log('Error logging stamp reset event:', error);
    }
    setNumber('');
    setSelectedKeys([]);
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

  /** 보유 쿠폰을 장 단위로 (사용 화면의 목록 소스) */
  const couponEntries = useMemo(
    () =>
      buildCouponEntries(
        user.coupons,
        user.couponIssuedAt,
        storeConfig.couponTypes ?? [],
        couponExpiryDays,
      ),
    [user.coupons, user.couponIssuedAt, storeConfig.couponTypes, couponExpiryDays],
  );

  const toggleCoupon = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );
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
            const userProfile = normalizeUser(
              data,
              storeConfig.couponTypes,
              storeConfig.mode,
            );
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
            setLoaded(true);
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
    /** 문서를 아직 못 읽었으면 false — 적립/사용 버튼을 비활성화하는 데 쓴다 */
    loaded,
    couponEntries,
    selectedKeys,
    selectedCount: selectedKeys.length,
    toggleCoupon,
    clearSelection,
    setNumber,
    switchMode,
    onNumberPress,
    phoneNumberLabel,
    close,
    handleApprove,
    handleApprovePoint,
    handleUsing,
    handleUsingPoint,
  };
}
