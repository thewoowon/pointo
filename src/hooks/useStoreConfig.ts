import {useEffect, useState} from 'react';
import {doc, getFirestore, onSnapshot} from '@react-native-firebase/firestore';

/** 레거시 매장용 쿠폰 타입 (americano/beverage 키를 그대로 사용) */
const LEGACY_COUPON_TYPES: CouponType[] = [
  {id: 'americano', name: '아메리카노 쿠폰', description: '무료 쿠폰이 한장 생겨요!'},
  {id: 'beverage', name: '음료 쿠폰', description: '무료 쿠폰이 한장 생겨요!'},
];

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  mode: 'stamp',
  stampsPerCoupon: 10,
  couponTypes: [
    {id: 'coupon_a', name: '무료 쿠폰', description: '무료 쿠폰이 한장 생겨요!'},
  ],
  couponSequence: ['coupon_a'],
  couponExpiryDays: 180,
  levelTiers: [
    {maxLevel: 0, emoji: '🌱', name: '새싹', color: '#6B9E78', bgColor: 'rgba(107,158,120,0.12)'},
    {maxLevel: 3, emoji: '⭐', name: '단골', color: '#D4845A', bgColor: 'rgba(212,132,90,0.12)'},
    {maxLevel: 7, emoji: '🏆', name: '단골왕', color: '#C89A2E', bgColor: 'rgba(200,154,46,0.12)'},
    {maxLevel: Infinity, emoji: '👑', name: '레전드', color: '#9B59B6', bgColor: 'rgba(155,89,182,0.12)'},
  ],
  levelIncrementOn: 'coupon_a',
  // 기존 포인트 매장은 전부 직원이 포인트를 직접 넣고 있다. 기본값을 'manual'로
  // 두면 config에 이 키가 없는 매장이 전부 지금 그대로 동작한다 — 백필이 없다.
  pointEarnMode: 'manual',
  rewardRateBps: 0,
  pointPresets: [],
  pointUnit: '원',
  sessionTimeoutSeconds: 60,
  idleTimeoutMs: 300000,
  welcomeLines: ['오늘도 방문해주셔서', '감사합니다!', '스탬프를 적립해보세요.'],
  guideLines: ['스탬프 조회 또는 가입을 위해', '전화번호를 입력해주세요.'],
  companyName: '룰루랄라 컴퍼니',
  contactEmail: 'thewoowon@gmail.com',
};

/** 매장 문서의 raw data → 화면이 쓰는 StoreConfig */
const toConfig = (data: Record<string, any> | undefined): StoreConfig => {
  if (!data?.config) {
    // config 필드 자체가 없는 레거시 매장
    return {
      ...DEFAULT_STORE_CONFIG,
      couponTypes: LEGACY_COUPON_TYPES,
      couponSequence: ['americano', 'beverage'],
      levelIncrementOn: 'americano',
    };
  }

  const merged = {...DEFAULT_STORE_CONFIG, ...data.config};
  // 레거시 매장 감지: couponTypes 없음 OR default coupon_a 1개만 있는 경우
  // (매장 설정에서 명시적으로 저장한 적 없는 매장)
  const ct = data.config.couponTypes;
  const isLegacy = !ct || (ct.length === 1 && ct[0].id === 'coupon_a');
  if (isLegacy) {
    merged.couponTypes = LEGACY_COUPON_TYPES;
    merged.couponSequence = ['americano', 'beverage'];
    merged.levelIncrementOn = 'americano';
  }
  return merged;
};

type Entry = {
  config: StoreConfig;
  subscribers: Set<(config: StoreConfig) => void>;
  stop: () => void;
};

/**
 * 매장당 리스너 하나를 모든 소비자가 공유한다.
 *
 * 예전엔 훅마다 마운트 시 getDoc 한 번이었는데, 그러면 이미 떠 있는 화면은
 * 매장 설정이 바뀌어도 옛 config를 계속 들고 있다 — 관리자 화면(MainScreen에
 * 상시 마운트되는 GivePointSheet)이 포인트↔스탬프 전환을 못 따라가던 원인.
 *
 * 캐시를 두는 이유는 하나 더 있다. 새로 마운트되는 훅이 DEFAULT_STORE_CONFIG를
 * 잠깐 반환하면 그 사이 쿠폰 키가 기본값(coupon_a)으로 잘못 매핑된다.
 * 캐시가 있으면 첫 렌더부터 제대로 된 값을 준다.
 */
const cache = new Map<string, Entry>();

const acquire = (storeCode: string): Entry => {
  const existing = cache.get(storeCode);
  if (existing) return existing;

  const entry: Entry = {
    config: DEFAULT_STORE_CONFIG,
    subscribers: new Set(),
    stop: () => {},
  };
  cache.set(storeCode, entry);

  entry.stop = onSnapshot(
    doc(getFirestore(), 'stores', storeCode),
    snap => {
      if (!snap.exists) return;
      entry.config = toConfig(snap.data());
      entry.subscribers.forEach(fn => fn(entry.config));
    },
    error => console.error('Error watching store config:', error),
  );

  return entry;
};

const useStoreConfig = (storeCode?: string | null): StoreConfig => {
  const [config, setConfig] = useState<StoreConfig>(
    () => (storeCode && cache.get(storeCode)?.config) || DEFAULT_STORE_CONFIG,
  );

  useEffect(() => {
    if (!storeCode) {
      setConfig(DEFAULT_STORE_CONFIG);
      return;
    }

    const entry = acquire(storeCode);
    setConfig(entry.config);
    entry.subscribers.add(setConfig);

    return () => {
      entry.subscribers.delete(setConfig);
      // 마지막 소비자가 떠나면 리스너를 접는다. 다시 필요해지면 acquire가 건다.
      if (entry.subscribers.size === 0) {
        entry.stop();
        cache.delete(storeCode);
      }
    };
  }, [storeCode]);

  return config;
};

export default useStoreConfig;
