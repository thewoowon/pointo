/**
 * Firestore raw data ↔ User 변환 및 쿠폰 계산 유틸리티.
 */

import dayjs from 'dayjs';

/**
 * Firestore에서 읽은 raw data → User 객체 변환.
 *
 * 쿠폰 id 체계는 매장 설정(couponTypes)이 정한다. 스탬프 모드에서 쿠폰을
 * 1종/2종으로 쓸 수 있도록 `coupon_a`/`coupon_b`로 고정하는 것이 표준이고,
 * 설정을 저장한 적 없는 오래된 매장만 폴백으로 `americano`/`beverage`를 쓴다.
 * 그래서 문서에 남아 있는 옛 키를 현재 매장의 id로 옮겨준다.
 */
export function normalizeUser(
  data: Record<string, any>,
  couponTypes?: CouponType[],
): User {
  const firstId = couponTypes?.[0]?.id ?? 'americano';
  const secondId = couponTypes?.[1]?.id ?? 'beverage';
  const coupons: Record<string, number> = {};

  if (data.coupons) {
    const raw = data.coupons as Record<string, number>;
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'americano' && firstId !== 'americano') {
        coupons[firstId] = value;
      } else if (key === 'beverage' && secondId !== 'beverage') {
        coupons[secondId] = value;
      } else {
        coupons[key] = value;
      }
    }
  }

  const couponIssuedAt: Record<string, string[]> | undefined =
    data.couponIssuedAt ?? undefined;

  return {
    last_used: data.last_used ?? '',
    level: data.level ?? 0,
    stamps: data.stamps ?? 0,
    phase: data.phase ?? firstId,
    coupons,
    couponIssuedAt,
    hasRated: data.hasRated,
    created_at: data.created_at,
    store_code: data.store_code,
  };
}

/** couponTypes 배열에서 각 타입별 초기값 0으로 빈 맵 생성 */
export function emptyCouponsMap(couponTypes: CouponType[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const ct of couponTypes) {
    map[ct.id] = 0;
  }
  return map;
}

/** UserContext 초기화 헬퍼 */
export function makeUserContext(
  coupons: Record<string, number>,
  couponTypes: CouponType[],
): UserContext {
  const possibleCoupons: Record<string, number> = {};
  const selectedCoupon: Record<string, number> = {};
  for (const ct of couponTypes) {
    possibleCoupons[ct.id] = coupons[ct.id] ?? 0;
    selectedCoupon[ct.id] = 0;
  }
  return {possibleCoupons, selectedCoupon};
}

/** 선택된 쿠폰 총 개수 */
export function totalSelected(selected: Record<string, number>): number {
  return Object.values(selected).reduce((sum, v) => sum + v, 0);
}

/** 쿠폰 보유 합계 */
export function totalCoupons(coupons: Record<string, number>): number {
  return Object.values(coupons).reduce((sum, v) => sum + v, 0);
}

/** 쿠폰 발급 시점 배열에 새 발급 추가 */
export function addCouponTimestamp(
  issuedAt: Record<string, string[]> | undefined,
  typeId: string,
  count: number,
): Record<string, string[]> {
  const result = {...(issuedAt ?? {})};
  const now = new Date().toISOString();
  const existing = Array.isArray(result[typeId]) ? [...result[typeId]] : [];
  for (let i = 0; i < count; i++) {
    existing.push(now);
  }
  result[typeId] = existing;
  return result;
}

/** 쿠폰 사용 시 가장 오래된 발급 시점부터 제거 (FIFO) */
export function removeCouponTimestamps(
  issuedAt: Record<string, string[]> | undefined,
  used: Record<string, number>,
): Record<string, string[]> {
  const result = {...(issuedAt ?? {})};
  for (const [typeId, count] of Object.entries(used)) {
    if (count > 0 && Array.isArray(result[typeId])) {
      result[typeId] = result[typeId].slice(count);
    }
  }
  return result;
}

/** 만료된 쿠폰 필터링. 유효기간 0이면 만료 없음. */
export function filterExpiredCoupons(
  coupons: Record<string, number>,
  issuedAt: Record<string, string[]> | undefined,
  expiryDays: number,
): {coupons: Record<string, number>; issuedAt: Record<string, string[]>; expiredCount: number} {
  if (expiryDays <= 0 || !issuedAt) {
    return {coupons, issuedAt: issuedAt ?? {}, expiredCount: 0};
  }

  const now = dayjs();
  const filtered: Record<string, number> = {};
  const filteredIssuedAt: Record<string, string[]> = {};
  let expiredCount = 0;

  for (const [typeId, count] of Object.entries(coupons)) {
    const dates = issuedAt[typeId];
    if (!Array.isArray(dates) || dates.length === 0) {
      // 발급 시점 정보가 없는 레거시 쿠폰 → 만료시키지 않음
      filtered[typeId] = count;
      continue;
    }
    const valid = dates.filter(d => now.diff(dayjs(d), 'day') < expiryDays);
    const expired = dates.length - valid.length;
    expiredCount += expired;
    const untrackedCount = Math.max(0, count - dates.length);
    filtered[typeId] = valid.length + untrackedCount;
    filteredIssuedAt[typeId] = valid;
  }

  return {coupons: filtered, issuedAt: filteredIssuedAt, expiredCount};
}

/** 특정 쿠폰 타입의 가장 빠른 만료일 반환 (없으면 null) */
export function getEarliestExpiry(
  issuedAt: Record<string, string[]> | undefined,
  typeId: string,
  expiryDays: number,
): string | null {
  if (expiryDays <= 0 || !issuedAt?.[typeId]?.length) return null;
  const earliest = issuedAt[typeId][0];
  return dayjs(earliest).add(expiryDays, 'day').format('YYYY.MM.DD');
}
