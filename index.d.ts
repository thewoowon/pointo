declare module '@env' {
  export const FIREBASE_API_KEY: string;
  export const API_URL: string;
  export const GOOGLE_IOS_CLIENT_ID: string;
  export const GOOGLE_IOS_URL_SCHEME: string;
  export const GOOGLE_AOS_CLIENT_ID: string;
  export const GOOGLE_SHA1: string;
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
  /** 쿠폰별 발급 시점 (coupon type id → ISO 날짜 배열, 오래된 순) */
  couponIssuedAt?: Record<string, string[]>;
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
  /** 쿠폰 유효기간 (일). 0이면 무기한. */
  couponExpiryDays: number;
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
  /** 이메일 계정(점주)에 연결된 경우의 소유자 uid. 미연결 스토어는 없음 */
  ownerId?: string;
}

/** 구글 계정으로 로그인하는 점주. Firestore `owners/{uid}` (uid = 구글 계정 고유 id) */
interface Owner {
  email: string;
  createdAt: string;
  /** 소유 스토어 코드 목록 */
  storeCodes: string[];
  /** 개설 가능한 최대 스토어 수 (기본 3, 구독 시 10) */
  slotLimit: number;
  /** 구독 정보 (Phase 2에서 결제 연동) */
  subscription?: {
    status: 'active' | 'expired' | 'none';
    productId?: string;
    expiresAt?: string;
  } | null;
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
