/**
 * Firestore 레거시 필드(americanoCoupons, beverageCoupons)를
 * 동적 coupons Record로 정규화하는 유틸리티.
 */

/** Firestore에서 읽은 raw data → User 객체 변환.
 *  couponTypes를 전달하면 레거시 필드를 해당 매장의 쿠폰 ID로 매핑합니다. */
export function normalizeUser(
  data: Record<string, any>,
  couponTypes?: CouponType[],
): User {
  const firstId = couponTypes?.[0]?.id ?? 'americano';
  const secondId = couponTypes?.[1]?.id ?? 'beverage';
  const coupons: Record<string, number> = {};

  if (data.coupons) {
    // coupons 맵이 있으면 레거시 키(americano/beverage)를 매장 쿠폰 ID로 리매핑
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

  // 레거시 flat 필드로 보완 (coupons에 아직 없는 경우만)
  if (data.americanoCoupons != null && coupons[firstId] == null) {
    coupons[firstId] = data.americanoCoupons;
  }
  if (data.beverageCoupons != null && coupons[secondId] == null) {
    coupons[secondId] = data.beverageCoupons;
  }

  return {
    last_used: data.last_used ?? '',
    level: data.level ?? 0,
    stamps: data.stamps ?? 0,
    phase: data.phase ?? firstId,
    coupons,
    hasRated: data.hasRated,
    created_at: data.created_at,
    store_code: data.store_code,
  };
}

/** User.coupons → Firestore에 쓸 flat 필드로 변환 (레거시 호환).
 *  couponTypes를 전달하면 첫 번째/두 번째 쿠폰을 americanoCoupons/beverageCoupons로 매핑합니다. */
export function flattenCouponsForFirestore(
  coupons: Record<string, number>,
  couponTypes?: CouponType[],
): Record<string, any> {
  const result: Record<string, any> = {coupons};
  // 레거시 필드도 동시에 기록 (구버전 앱 하위 호환)
  if (couponTypes && couponTypes.length > 0) {
    result.americanoCoupons = coupons[couponTypes[0].id] ?? 0;
    result.beverageCoupons =
      couponTypes.length >= 2 ? (coupons[couponTypes[1].id] ?? 0) : 0;
  } else {
    result.americanoCoupons = coupons.americano ?? 0;
    result.beverageCoupons = coupons.beverage ?? 0;
  }
  return result;
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
