/**
 * AARRR 기반 이벤트 스키마.
 * 모든 이벤트는 Firebase Analytics로 전송되고, 포트폴리오 지표로 환산됨.
 *
 * 세그먼트 분석 예시:
 *   - "단골왕(tier=vip) 유저의 coupon_redeemed / coupon_issued 비율"
 *   - "signup_completed → stamp_earned 전환율 (activation rate)"
 *   - "user_returned days_since_last_visit 분포 → 리텐션 곡선"
 */

export const AnalyticsEvent = {
  // ── Acquisition ────────────────────────────────
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',

  // ── Activation / Engagement ────────────────────
  STAMP_EARNED: 'stamp_earned',
  FIRST_VISIT_OF_DAY: 'first_visit_of_day',

  // ── Retention ──────────────────────────────────
  USER_RETURNED: 'user_returned',

  // ── Reward / Revenue-proxy ─────────────────────
  COUPON_ISSUED: 'coupon_issued',
  COUPON_REDEEMED: 'coupon_redeemed',

  // ── Loyalty ────────────────────────────────────
  TIER_UP: 'tier_up',

  // ── Satisfaction ───────────────────────────────
  RATING_SUBMITTED: 'rating_submitted',

  // ── Owner Ops ──────────────────────────────────
  OWNER_LOGIN: 'owner_login',
  OWNER_LOGOUT: 'owner_logout',
  CUSTOMER_LOOKUP: 'customer_lookup',
  STAMP_RESET: 'stamp_reset',
  SESSION_ENDED: 'session_ended',
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export type UserTier = 'seedling' | 'regular' | 'vip' | 'legend';

const DEFAULT_TIER_THRESHOLDS: {maxLevel: number; tier: UserTier}[] = [
  {maxLevel: 0, tier: 'seedling'},
  {maxLevel: 3, tier: 'regular'},
  {maxLevel: 7, tier: 'vip'},
];

export const getTierFromLevel = (
  level: number,
  levelTiers?: LevelTier[],
): UserTier => {
  if (!levelTiers || levelTiers.length === 0) {
    // 기본 임계값 사용
    for (const t of DEFAULT_TIER_THRESHOLDS) {
      if (level <= t.maxLevel) return t.tier;
    }
    return 'legend';
  }

  // config levelTiers 기반: 티어 순서대로 매핑
  const tierNames: UserTier[] = ['seedling', 'regular', 'vip', 'legend'];
  const sorted = [...levelTiers].sort((a, b) => a.maxLevel - b.maxLevel);
  for (let i = 0; i < sorted.length; i++) {
    if (level <= sorted[i].maxLevel) {
      return tierNames[Math.min(i, tierNames.length - 1)];
    }
  }
  return tierNames[tierNames.length - 1];
};

export const getReturnBucket = (
  daysSinceLastVisit: number,
): 'd1' | 'd7' | 'd30' | 'd30_plus' => {
  if (daysSinceLastVisit <= 1) return 'd1';
  if (daysSinceLastVisit <= 7) return 'd7';
  if (daysSinceLastVisit <= 30) return 'd30';
  return 'd30_plus';
};

/**
 * 개인정보를 Analytics에 넘기지 않기 위해 phone을 안정 해시로 변환.
 * 동일 phone → 동일 user_id 보장 (세그먼트 추적 가능).
 * 분석 목적이므로 충돌은 무시 가능한 수준.
 */
export const hashPhone = (phone: string): string => {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    hash = (hash << 5) - hash + phone.charCodeAt(i);
    hash |= 0;
  }
  return `u_${Math.abs(hash).toString(36)}`;
};

export interface BaseEventParams {
  store_code?: string | null;
  user_id?: string; // hashed phone
  user_tier?: UserTier;
  user_level?: number;
  stamps_total?: number;
  days_since_signup?: number;
  days_since_last_visit?: number;
}
