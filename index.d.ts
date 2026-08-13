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

/**
 * 고객 화면 "최근내역"용 이력 한 줄. `logs` 컬렉션과 별개로 users 문서에
 * 비정규화해 둔다 — logs 읽기는 점주 전용(firestore.rules)이라 익명 세션인
 * 키오스크가 조회할 수 없기 때문. 최근 RECENT_LOG_LIMIT건만 유지한다.
 */
interface RecentLog {
  action: 'stamp_saved' | 'stamp_used';
  /** 포인트 모드=포인트 수, 스탬프 모드=스탬프 수(쿠폰 사용이면 장수) */
  amount: number;
  /** 발생 시각 (ISO 8601) */
  at: string;
  /** 표시용 부가 설명. 쿠폰 사용이면 '아메리카노 쿠폰 1장' 같은 문구 */
  note?: string;
}

interface User {
  last_used: string;
  level: number;
  /**
   * 스탬프 모드의 현재 판에 찍힌 스탬프 수. **스탬프 모드 전용 필드다.**
   * 포인트 모드는 절대 이 값을 읽거나 쓰지 않는다 — 예전엔 두 모드가 이 필드를
   * 공유해서, 포인트 매장이 스탬프 모드로 바뀌면 handleApprove의
   * `stamps % stampsPerCoupon`이 34만 포인트를 한 자리로 잘라버렸다.
   */
  stamps: number;
  /**
   * 포인트 모드의 적립금 잔액. **포인트 모드 전용 필드다.**
   * 문서에 없으면(마이그레이션 전 레거시) normalizeUser가 포인트 모드일 때만
   * stamps에서 넘겨받는다 — utils/coupons.normalizeUser 참고.
   */
  points: number;
  phase: string;
  /** 동적 쿠폰 보유 현황 (coupon type id → 개수) */
  coupons: Record<string, number>;
  /** 쿠폰별 발급 시점 (coupon type id → ISO 날짜 배열, 오래된 순) */
  couponIssuedAt?: Record<string, string[]>;
  /** 최근 적립/사용 이력 (최신순). 없으면 아직 한 번도 안 쌓인 문서 */
  recentLogs?: RecentLog[];
  // 별점을 위해 추가된 속성
  hasRated?: boolean | null | undefined;
  // 코호트/리텐션 분석을 위한 가입일
  created_at?: string;
  store_code?: string;
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

/**
 * 소셜 로그인으로 접속하는 점주. Firestore `owners/{uid}`.
 *
 * uid = **Firebase Auth uid**. (보안 규칙이 request.auth.uid로 소유권을 검증하므로
 * 반드시 Firebase uid여야 한다. Firebase Auth 도입 전에는 구글/애플 제공자 id를
 * 썼고, 그 문서들은 재로그인 시 migrateLegacyOwner가 새 uid로 옮긴다.)
 */
interface Owner {
  email: string;
  createdAt: string;
  /** 이전 전 제공자 id. 마이그레이션된 계정에만 존재 — 추적/롤백용 */
  legacyUid?: string;
  /** 계정 이전 시각(ISO) */
  migratedAt?: string;
  /** 레거시 문서에만 남는 표식. 이 문서는 폐기됐고 값이 새 uid를 가리킨다. */
  migratedTo?: string;
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
  /**
   * 계정 상태. 'pending_deletion'이면 30일 유예 중 — 재로그인 시 매장 진입을 막고
   * 복구/영구삭제만 노출한다. 없으면 'active'로 간주(레거시 호환).
   */
  accountStatus?: 'active' | 'pending_deletion';
  /** 탈퇴 요청 시각(ISO). 스케줄 Function이 +30일 경과분을 hard delete. */
  deletedAt?: string | null;
}

/**
 * 기록 시점의 매장 운영 모드. `stamp`면 `stamp` 필드가 스탬프 개수,
 * `point`면 포인트 금액이다 — 같은 필드에 단위가 다른 값이 들어간다.
 *
 * 모드를 바꾼 매장은 로그에 두 단위가 섞이므로, 집계할 땐 현재 매장 모드가
 * 아니라 **로그마다 이 값을** 봐야 한다. 필드가 없는 로그는 이 값이 생기기 전
 * 기록이고, 그 시점까진 어느 매장도 모드를 바꾼 적이 없어서 매장의 현재
 * 모드로 봐도 안전하다.
 */
type LogMode = 'stamp' | 'point';

interface Log {
  action: 'stamp_saved' | 'stamp_used';
  phone_number: string;
  timestamp: Date;
  stamp: number;
  note: string;
  store_code?: string;
  user_level?: number;
  coupons_issued?: number;
  mode?: LogMode;
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
  mode?: LogMode;
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
