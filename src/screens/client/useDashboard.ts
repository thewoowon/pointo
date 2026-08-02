import {useCallback, useEffect, useRef, useState} from 'react';
import {useAuth, useFirestore, useAnalytics, useStoreConfig} from '../../hooks';
import {AnalyticsEvent, hashPhone} from '../../analytics/events';
import {getFirestore, doc, onSnapshot} from '@react-native-firebase/firestore';
import {normalizeUser, getEarliestExpiry, filterExpiredCoupons} from '../../utils/coupons';
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

export const getLevelInfo = (level: number, tiers: LevelTier[]): LevelInfo => {
  const sorted = [...tiers].sort((a, b) => a.maxLevel - b.maxLevel);
  for (const tier of sorted) {
    if (level <= tier.maxLevel) return tier;
  }
  return sorted[sorted.length - 1];
};

type OverlayContext = {
  show: boolean;
  type: string;
  dStamp: 'one' | 'two' | 'coupon';
};

export function useDashboard(phoneNumber: string, onClose: () => void) {
  const {storeCode, storeName} = useAuth();
  const storeConfig = useStoreConfig(storeCode);
  const isPointMode = storeConfig.mode === 'point';
  const [timeLeft, setTimeLeft] = useState(60);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [prevUser, setPrevUser] = useState<User | null>(null);
  const [overlayContext, setOverlayContext] = useState<OverlayContext>({
    show: false,
    type: 'americano',
    dStamp: 'one',
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userRef = useRef<User | null>(null);
  const prevUserRef = useRef<User | null>(null);

  const {updateSession, resolveUserDocId} = useFirestore(storeCode);
  const {track} = useAnalytics();

  const phoneNumberLabel = useCallback(() => {
    if (!phoneNumber || phoneNumber.length < 7) return phoneNumber || '';
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7)}`;
  }, [phoneNumber]);

  const goBack = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeLeft(0);
  }, []);

  const dismissOverlay = useCallback(() => {
    setOverlayContext(prev => ({...prev, show: false}));
  }, []);

  const getCouponName = useCallback(
    (typeId: string) => {
      return storeConfig.couponTypes.find(c => c.id === typeId)?.name;
    },
    [storeConfig.couponTypes],
  );

  const delayBeforeUpdate = useCallback(
    (type: string, dStamp: 'one' | 'two' | 'coupon') => {
      setOverlayContext({show: true, type, dStamp});
    },
    [],
  );

  const lastVisitMessage = user?.last_used
    ? getLastVisitMessage(user.last_used)
    : '오늘도 좋은 하루 되세요 ><';

  const levelInfo = user ? getLevelInfo(user.level, storeConfig.levelTiers) : null;

  const hasChange =
    user &&
    prevUser &&
    (() => {
      const prevCouponTotal = Object.values(prevUser.coupons).reduce(
        (s, v) => s + v,
        0,
      );
      const newCouponTotal = Object.values(user.coupons).reduce(
        (s, v) => s + v,
        0,
      );
      return (
        user.stamps !== prevUser.stamps || newCouponTotal !== prevCouponTotal
      );
    })();

  const changeSummary = (() => {
    if (!user || !prevUser || !hasChange) return null;
    if (isPointMode) {
      const diff = user.stamps - prevUser.stamps;
      return {
        type: diff > 0 ? ('earn' as const) : ('use' as const),
        amount: Math.abs(diff),
        unit: storeConfig.pointUnit,
      };
    }
    const prevCT = Object.values(prevUser.coupons).reduce((s, v) => s + v, 0);
    const newCT = Object.values(user.coupons).reduce((s, v) => s + v, 0);
    const couponsEarned = newCT - prevCT;
    if (user.stamps !== prevUser.stamps || couponsEarned > 0) {
      const earned =
        couponsEarned * storeConfig.stampsPerCoupon +
        user.stamps -
        prevUser.stamps;
      return {type: 'earn' as const, amount: earned, unit: '개'};
    }
    const used = prevCT - newCT;
    return {type: 'use' as const, amount: used, unit: '장'};
  })();

  const availableCoupons = user
    ? storeConfig.couponTypes
        .map(ct => {
          const count = user.coupons[ct.id] ?? 0;
          if (count <= 0) return null;
          const expiry = getEarliestExpiry(
            user.couponIssuedAt,
            ct.id,
            storeConfig.couponExpiryDays,
          );
          return {id: ct.id, name: ct.name, count, expiry};
        })
        .filter(Boolean)
    : [];

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
            const initial = normalizeUser(data, storeConfig.couponTypes);
            const {coupons: vc, issuedAt: vi} = filterExpiredCoupons(
              initial.coupons,
              initial.couponIssuedAt,
              storeConfig.couponExpiryDays,
            );
            setUser({...initial, coupons: vc, couponIssuedAt: vi});
            return;
          }

          const raw = normalizeUser(data, storeConfig.couponTypes);
          const {coupons: vc, issuedAt: vi} = filterExpiredCoupons(
            raw.coupons,
            raw.couponIssuedAt,
            storeConfig.couponExpiryDays,
          );
          const updatedUser = {...raw, coupons: vc, couponIssuedAt: vi};

          setPrevUser(userRef.current);
          setUser(updatedUser);

          if (!isPointMode) {
            const prevTotal = Object.values(
              userRef.current?.coupons ?? {},
            ).reduce((s, v) => s + v, 0);
            const newTotal = Object.values(updatedUser.coupons).reduce(
              (s, v) => s + v,
              0,
            );
            if (newTotal > prevTotal) {
              delayBeforeUpdate(updatedUser.phase, 'coupon');
            } else if (
              updatedUser.stamps > (userRef.current?.stamps || 0)
            ) {
              if (
                updatedUser.stamps ===
                storeConfig.stampsPerCoupon - 1
              ) {
                delayBeforeUpdate(updatedUser.phase, 'one');
              } else if (
                updatedUser.stamps ===
                storeConfig.stampsPerCoupon - 2
              ) {
                delayBeforeUpdate(updatedUser.phase, 'two');
              }
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
  }, [phoneNumber]);

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

  return {
    phoneNumber,
    storeName,
    storeConfig,
    isPointMode,
    timeLeft,
    user,
    prevUser,
    overlayContext,
    hasChange,
    changeSummary,
    lastVisitMessage,
    levelInfo,
    availableCoupons,
    phoneNumberLabel,
    goBack,
    dismissOverlay,
    getCouponName,
  };
}
