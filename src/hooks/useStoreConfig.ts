import {useEffect, useState} from 'react';
import {doc, getFirestore, getDoc} from '@react-native-firebase/firestore';

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  stampsPerCoupon: 10,
  couponTypes: [
    {id: 'americano', name: '아메리카노', description: '아메리카노 무료 쿠폰이 한장 생겨요!'},
    {id: 'beverage', name: '조제음료', description: '조제음료 무료 쿠폰이 한장 생겨요!'},
  ],
  couponSequence: ['americano', 'beverage'],
  levelTiers: [
    {maxLevel: 0, emoji: '🌱', name: '새싹', color: '#6B9E78', bgColor: 'rgba(107,158,120,0.12)'},
    {maxLevel: 3, emoji: '☕', name: '단골', color: '#D4845A', bgColor: 'rgba(212,132,90,0.12)'},
    {maxLevel: 7, emoji: '⭐', name: '단골왕', color: '#C89A2E', bgColor: 'rgba(200,154,46,0.12)'},
    {maxLevel: Infinity, emoji: '👑', name: '레전드', color: '#9B59B6', bgColor: 'rgba(155,89,182,0.12)'},
  ],
  levelIncrementOn: 'americano',
  sessionTimeoutSeconds: 60,
  idleTimeoutMs: 30000,
  welcomeLines: ['오늘도 찐~한 커피', '한 잔 마시고', '열심히 달려볼까요?'],
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
            setConfig({...DEFAULT_STORE_CONFIG, ...data.config});
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
