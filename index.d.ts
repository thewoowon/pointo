declare module '@env' {
  export const FIREBASE_API_KEY: string;
  export const API_URL: string;
}

declare module '*.svg' {
  import {FC, SVGProps} from 'react';
  const content: FC<SVGProps<SVGSVGElement>>;
  export default content;
}

interface Attendance {
  created_at: string;
}

interface User {
  last_used: string;
  level: number;
  stamps: number;
  phase: 'americano' | 'beverage';
  americanoCoupons: number;
  beverageCoupons: number;
  // 별점을 위해 추가된 속성
  hasRated?: boolean | null | undefined;
  // 코호트/리텐션 분석을 위한 가입일
  created_at?: string;
  store_code?: string;
}

interface UserContext {
  selectedCoupon: {
    americano: number;
    beverage: number;
  };
  possibleCoupons: {
    americano: number;
    beverage: number;
  };
}

interface CouponType {
  id: string;
  name: string;
  description: string;
}

interface LevelTier {
  maxLevel: number;
  emoji: string;
  name: string;
  color: string;
  bgColor: string;
}

interface StoreConfig {
  stampsPerCoupon: number;
  couponTypes: CouponType[];
  couponSequence: string[];
  levelTiers: LevelTier[];
  levelIncrementOn: string;
  sessionTimeoutSeconds: number;
  idleTimeoutMs: number;
  // 브랜딩
  welcomeLines: string[];
  guideLines: string[];
  companyName: string;
  contactEmail: string;
}

interface Store {
  last_logged: string;
  name?: string;
  ownerPhone?: string;
  createdAt?: string;
  status?: 'pending' | 'approved';
  config?: StoreConfig;
}

interface Log {
  action: 'stamp_saved' | 'stamp_used';
  phone_number: string;
  timestamp: Date;
  stamp: number;
  note: string;
  store_code?: string;
  user_level?: number;
  coupons_issued?: number;
}

interface LogDto {
  action: 'stamp_saved' | 'stamp_used';
  phone_number: string;
  timestamp: Timestamp;
  stamp: number;
  note: string;
  store_code?: string;
  user_level?: number;
  coupons_issued?: number;
}

interface Session {
  is_confirmed: boolean;
  last_used: string;
  phone: string;
  mode: string;
}

interface Rating {
  stars: number;
  createdAt: string;
}
