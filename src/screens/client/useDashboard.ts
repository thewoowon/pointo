import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAuth, useFirestore, useAnalytics, useStoreConfig} from '../../hooks';
import {AnalyticsEvent, hashPhone} from '../../analytics/events';
import {getFirestore, doc, onSnapshot} from '@react-native-firebase/firestore';
import {
  normalizeUser,
  buildCouponEntries,
  filterExpiredCoupons,
  totalCoupons,
} from '../../utils/coupons';
import dayjs from 'dayjs';

const getLastVisitMessage = (lastUsed: string): string => {
  if (!lastUsed) return '';
  const diff = dayjs().startOf('day').diff(dayjs(lastUsed), 'day');
  if (diff === 0) return '오늘도 찾아주셨네요 ><';
  if (diff === 1) return '어제 다녀가셨군요!';
  if (diff < 30) return `${diff}일 만에 오셨네요!`;
  return `${Math.floor(diff / 30)}달 만에 오셨네요!`;
};

type LevelInfo = {
  emoji: string;
  name: string;
  color: string;
  bgColor: string;
};

export const getLevelInfo = (
  level: number,
  tiers: LevelTier[],
): LevelInfo | null => {
  if (!tiers?.length) return null;
  const sorted = [...tiers].sort((a, b) => a.maxLevel - b.maxLevel);
  for (const tier of sorted) {
    if (level <= tier.maxLevel) return tier;
  }
  return sorted[sorted.length - 1];
};

/**
 * 쿠폰이 나온 순간의 2단 연출.
 *  - 'none'  평상시
 *  - 'full'  스탬프판을 꽉 찬 상태로 보여주는 구간 (실제 값은 이미 리셋됨)
 *  - 'earned' 판을 비우고 "쿠폰을 획득했습니다!"로 넘어간 상태
 */
type Celebration = 'none' | 'full' | 'earned';

/** 'full' 구간 길이. 꽉 찬 판을 눈으로 확인할 만큼만 잡는다. */
const CELEBRATION_FULL_MS = 1800;

export function useDashboard(phoneNumber: string, onClose: () => void) {
  const {storeCode, storeName} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const isPointMode = storeConfig.mode === 'point';
  const [timeLeft, setTimeLeft] = useState(60);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [prevUser, setPrevUser] = useState<User | null>(null);
  const [celebration, setCelebration] = useState<Celebration>('none');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const celebrationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef<User | null>(null);
  const prevUserRef = useRef<User | null>(null);

  const {updateSession, resolveUserDocId} = useFirestore(storeCode);
  const {track} = useAnalytics();

  const phoneNumberLabel = useCallback(() => {
    if (!phoneNumber || phoneNumber.length < 7) return phoneNumber || '';
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7)}`;
  }, [phoneNumber]);

  const endCelebration = useCallback(() => {
    if (celebrationRef.current) {
      clearTimeout(celebrationRef.current);
      celebrationRef.current = null;
    }
    setCelebration('none');
  }, []);

  // 쿠폰 발급 순간: 꽉 찬 판을 잠깐 보여준 뒤 비운다.
  const celebrateCoupon = useCallback(() => {
    if (celebrationRef.current) clearTimeout(celebrationRef.current);
    setCelebration('full');
    celebrationRef.current = setTimeout(() => {
      setCelebration('earned');
      celebrationRef.current = null;
    }, CELEBRATION_FULL_MS);
  }, []);

  const lastVisitMessage = user?.last_used
    ? getLastVisitMessage(user.last_used)
    : '오늘도 좋은 하루 되세요 ><';

  const levelInfo = user ? getLevelInfo(user.level, storeConfig.levelTiers) : null;

  const couponCount = user ? totalCoupons(user.coupons) : 0;

  // 무엇이 바뀌었는지는 모드마다 보는 필드가 다르다 — 포인트 모드는 points,
  // 스탬프 모드는 stamps/쿠폰. 한쪽 모드에서 다른 쪽 필드를 보면 모드를
  // 전환한 매장에서 있지도 않은 변화를 감지한다.
  const hasChange =
    !!user &&
    !!prevUser &&
    (isPointMode
      ? user.points !== prevUser.points
      : user.stamps !== prevUser.stamps ||
        couponCount !== totalCoupons(prevUser.coupons));

  const changeSummary = (() => {
    if (!user || !prevUser || !hasChange) return null;
    if (isPointMode) {
      const diff = user.points - prevUser.points;
      return {
        type: diff > 0 ? ('earn' as const) : ('use' as const),
        amount: Math.abs(diff),
        unit: storeConfig.pointUnit,
        couponsEarned: 0,
      };
    }
    const prevCT = totalCoupons(prevUser.coupons);
    const couponsEarned = couponCount - prevCT;
    if (user.stamps !== prevUser.stamps || couponsEarned > 0) {
      const earned =
        couponsEarned * storeConfig.stampsPerCoupon +
        user.stamps -
        prevUser.stamps;
      return {
        type: 'earn' as const,
        amount: earned,
        unit: '개',
        couponsEarned,
      };
    }
    return {
      type: 'use' as const,
      amount: prevCT - couponCount,
      unit: '장',
      couponsEarned: 0,
    };
  })();

  /** 보유 쿠폰을 장 단위로 (만료일이 장마다 달라서 집계하면 표현이 안 됨) */
  const couponEntries = useMemo(
    () =>
      user
        ? buildCouponEntries(
            user.coupons,
            user.couponIssuedAt,
            storeConfig.couponTypes ?? [],
            storeConfig.couponExpiryDays,
          )
        : [],
    [user, storeConfig.couponTypes, storeConfig.couponExpiryDays],
  );

  /** 최근내역 (포인트 모드 하단). users 문서에 비정규화된 값 — utils/recentLogs 참고 */
  const recentLogs = user?.recentLogs ?? [];

  // 현재 판에 찍힌 스탬프. 쿠폰이 나온 직후엔 잠시 꽉 찬 판을 보여준다.
  const stampCapacity = storeConfig.stampsPerCoupon || 10;
  const rawFilled = user ? user.stamps % stampCapacity : 0;
  const filledStamps = celebration === 'full' ? stampCapacity : rawFilled;

  // Firestore config는 부분 저장된 문서가 섞여 있어서 배열 필드가 없을 수 있다.
  // DEFAULT와 병합해도 `{key: undefined}`면 기본값을 덮어쓴다 — 여기서 한 번 막는다.
  const couponSequence = storeConfig.couponSequence ?? [];
  const couponTypes = storeConfig.couponTypes ?? [];

  /** 쿠폰 2종 이상을 번갈아 주는 매장인지 — '이번/다음번 보상' 칩의 노출 조건 */
  const isMultiReward = couponSequence.length > 1;

  const rewards = (() => {
    const seq = couponSequence;
    if (!seq.length) return {current: null, next: null};
    const nameOf = (id: string) =>
      couponTypes.find(ct => ct.id === id)?.name ?? null;
    // phase가 시퀀스에서 빠진 레거시 값이면 첫 번째로 본다 (useGivePoint와 동일 규칙)
    const idx = Math.max(seq.indexOf(user?.phase ?? seq[0]), 0);
    return {
      current: nameOf(seq[idx]),
      next: nameOf(seq[(idx + 1) % seq.length]),
    };
  })();

  const last4 = phoneNumber ? phoneNumber.slice(-4) : '';

  /** 큰 제목. 적립/사용이 일어났을 때만 인사말 대신 결과를 말한다. */
  const headline = (() => {
    if (!changeSummary) return `${last4}님, 반갑습니다!`;
    if (isPointMode) {
      const amt = `${changeSummary.amount.toLocaleString()}${changeSummary.unit}`;
      return changeSummary.type === 'earn'
        ? `${amt} 적립되었습니다`
        : `${amt} 사용되었습니다`;
    }
    if (celebration === 'earned') return '쿠폰을 획득했습니다!';
    return changeSummary.type === 'earn'
      ? `스탬프 ${changeSummary.amount}개가 적립되었습니다`
      : `쿠폰 ${changeSummary.amount}장을 사용했습니다`;
  })();

  /** 작은 부제. 쿠폰 모드에서만 — 포인트 모드는 카드가 같은 말을 한다. */
  const subline =
    isPointMode || !user
      ? null
      : `현재 쿠폰 ${couponCount}개와 스탬프 ${filledStamps}개가 있습니다.`;

  // Effects
  useEffect(() => {
    setTimeLeft(storeConfig.sessionTimeoutSeconds);
  }, [storeConfig.sessionTimeoutSeconds]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    prevUserRef.current = prevUser;
  }, [prevUser]);

  useEffect(() => {
    if (!phoneNumber) return;

    const db = getFirestore();
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const setup = async () => {
      const docId = await resolveUserDocId(phoneNumber);
      if (cancelled) return;
      const _userRef = doc(db, 'users', docId);

      unsubscribe = onSnapshot(_userRef, docSnap => {
        if (docSnap.exists) {
          const data = docSnap.data();
          if (!data) return;

          if (!userRef.current && !prevUserRef.current) {
            const initial = normalizeUser(data, storeConfig.couponTypes, storeConfig.mode);
            const {coupons: vc, issuedAt: vi} = filterExpiredCoupons(
              initial.coupons,
              initial.couponIssuedAt,
              storeConfig.couponExpiryDays,
            );
            setUser({...initial, coupons: vc, couponIssuedAt: vi});
            return;
          }

          const raw = normalizeUser(data, storeConfig.couponTypes, storeConfig.mode);
          const {coupons: vc, issuedAt: vi} = filterExpiredCoupons(
            raw.coupons,
            raw.couponIssuedAt,
            storeConfig.couponExpiryDays,
          );
          const updatedUser = {...raw, coupons: vc, couponIssuedAt: vi};

          setPrevUser(userRef.current);
          setUser(updatedUser);

          // 쿠폰이 늘었으면 스탬프는 이미 리셋된 값으로 도착한다.
          // 꽉 찬 판을 잠깐 보여준 뒤 비우는 2단 연출을 여기서 건다.
          // 그 다음 적립이 또 들어오면 연출을 접고 평상시 문구로 돌아간다.
          if (!isPointMode) {
            const prevTotal = totalCoupons(userRef.current?.coupons ?? {});
            if (totalCoupons(updatedUser.coupons) > prevTotal) {
              celebrateCoupon();
            } else {
              endCelebration();
            }
          }
        }
      });
    };

    setup();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // storeConfig도 의존: config는 비동기 로드되므로, 로드 전 구독이 걸리면
    // normalizeUser가 DEFAULT couponTypes로 쿠폰 키를 잘못 매핑한다(coupon_a).
    // config 도착 시 재구독해 올바른 couponTypes로 다시 정규화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber, storeConfig]);

  useEffect(() => {
    if (!storeCode) return;

    const db = getFirestore();
    const sessionRef = doc(db, 'sessions', `session_${storeCode}`);

    const unsubscribe = onSnapshot(sessionRef, docSnap => {
      if (docSnap.exists) {
        const data = docSnap.data();
        if (!data) return;

        if (data.phone === '' && data.mode === 'waiting') {
          setTimeLeft(3);
        }

        setSession(data as Session);
      }
    });

    return () => unsubscribe();
  }, [storeCode]);

  useEffect(() => {
    if (timeLeft === 0) {
      if (session && session.phone !== '') {
        try {
          track(AnalyticsEvent.SESSION_ENDED, {
            store_code: storeCode,
            user_id: hashPhone(session.phone),
            reason: 'timeout',
          });
        } catch {}
        updateSession(`session_${storeCode}`, {
          last_used: new Date().toISOString().split('T')[0],
          phone: '',
          mode: 'waiting',
        });
      }
      onClose();
    }
  }, [timeLeft, session, storeCode]);

  useEffect(() => {
    if (timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timeLeft]);

  useEffect(
    () => () => {
      if (celebrationRef.current) clearTimeout(celebrationRef.current);
    },
    [],
  );

  return {
    phoneNumber,
    last4,
    storeName,
    storeConfig,
    isPointMode,
    timeLeft,
    user,
    prevUser,
    hasChange,
    changeSummary,
    headline,
    subline,
    lastVisitMessage,
    levelInfo,
    couponCount,
    couponEntries,
    recentLogs,
    stampCapacity,
    filledStamps,
    celebration,
    isMultiReward,
    rewards,
    phoneNumberLabel,
  };
}
