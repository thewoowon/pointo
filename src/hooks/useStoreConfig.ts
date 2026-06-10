import {useEffect, useState} from 'react';
import {doc, getFirestore, getDoc} from '@react-native-firebase/firestore';

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
  pointPresets: [],
  pointUnit: '원',
  sessionTimeoutSeconds: 60,
  idleTimeoutMs: 300000,
  welcomeLines: ['오늘도 방문해주셔서', '감사합니다!', '스탬프를 적립해보세요.'],
  guideLines: ['스탬프 조회 또는 가입을 위해', '전화번호를 입력해주세요.'],
  companyName: '룰루랄라 컴퍼니',
  contactEmail: 'thewoowon@gmail.com',
};

const useStoreConfig = (storeCode?: string | null): StoreConfig => {
  const [config, setConfig] = useState<StoreConfig>(DEFAULT_STORE_CONFIG);

  useEffect(() => {
    if (!storeCode) return;

    const fetchConfig = async () => {
      try {
        const db = getFirestore();
        const storeSnap = await getDoc(doc(db, 'stores', storeCode));
        if (storeSnap.exists) {
          const data = storeSnap.data();
          if (data?.config) {
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
            setConfig(merged);
          } else {
            // config 필드 자체가 없는 레거시 매장
            setConfig({
              ...DEFAULT_STORE_CONFIG,
              couponTypes: LEGACY_COUPON_TYPES,
              couponSequence: ['americano', 'beverage'],
              levelIncrementOn: 'americano',
            });
          }
        }
      } catch (error) {
        console.error('Error fetching store config:', error);
      }
    };

    fetchConfig();
  }, [storeCode]);

  return config;
};

export default useStoreConfig;
