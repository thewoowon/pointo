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
  phase: string;
  /** 동적 쿠폰 보유 현황 (coupon type id → 개수) */
  coupons: Record<string, number>;
  // Firestore 레거시 필드 (하위 호환)
  americanoCoupons?: number;
  beverageCoupons?: number;
  // 별점을 위해 추가된 속성
  hasRated?: boolean | null | undefined;
  // 코호트/리텐션 분석을 위한 가입일
  created_at?: string;
  store_code?: string;
}

interface UserContext {
  selectedCoupon: Record<string, number>;
  possibleCoupons: Record<string, number>;
}

interface CouponType {
  id: string;
  name: string;
  description: string;
}

interface PointPreset {
  id: string;
  name: string;
  points: number;
}

interface LevelTier {
  maxLevel: number;
  emoji: string;
  name: string;
  color: string;
  bgColor: string;
}

interface StoreConfig {
  /** 'stamp' = 스탬프 카드 모델, 'point' = 포인트(적립금) 모델 */
  mode: 'stamp' | 'point';
  // ── 스탬프 모드 전용 ──
  stampsPerCoupon: number;
  couponTypes: CouponType[];
  couponSequence: string[];
  levelIncrementOn: string;
  // ── 포인트 모드 전용 ──
  pointPresets: PointPreset[];
  pointUnit: string;
  // ── 공통 ──
  levelTiers: LevelTier[];
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
