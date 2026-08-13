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
 *
 * `mode`는 포인트 잔액을 어디서 읽을지 정한다. points 필드가 생기기 전
 * 포인트 매장은 잔액을 stamps에 쌓아뒀기 때문에, 문서에 points가 아직 없으면
 * **포인트 모드일 때만** stamps를 잔액으로 넘겨받는다. 스탬프 모드에서
 * 같은 폴백을 걸면 판에 찍힌 스탬프가 그대로 적립금이 돼버린다.
 * (scripts/migrate-points-field.mjs 백필이 끝나면 이 폴백은 죽은 코드가 된다)
 */
export function normalizeUser(
  data: Record<string, any>,
  couponTypes?: CouponType[],
  mode?: StoreConfig['mode'],
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
    points: data.points ?? (mode === 'point' ? data.stamps ?? 0 : 0),
    phase: data.phase ?? firstId,
    coupons,
    couponIssuedAt,
    recentLogs: Array.isArray(data.recentLogs) ? data.recentLogs : [],
    hasRated: data.hasRated,
    created_at: data.created_at,
    store_code: data.store_code,
  };
}

/**
 * 포인트 잔액 읽기. **포인트 모드에서만 부른다.**
 *
 * normalizeUser를 거치지 않은 raw 문서(고객 검색 목록 등)용 폴백 —
 * points 필드가 생기기 전 문서는 잔액이 stamps에 들어 있다.
 * 백필(scripts/migrate-points-field.mjs) 후에는 항상 points가 잡힌다.
 */
export function pointsOf(u: {points?: number; stamps?: number}): number {
  return u.points ?? u.stamps ?? 0;
}

/** couponTypes 배열에서 각 타입별 초기값 0으로 빈 맵 생성 */
export function emptyCouponsMap(couponTypes: CouponType[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const ct of couponTypes) {
    map[ct.id] = 0;
  }
  return map;
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

/** 보유 쿠폰 1장 = 1개 항목. 발급 시점이 제각각이라 만료일도 장마다 다르다. */
export type CouponEntry = {
  /** 리스트 key. `${typeId}-${index}` */
  key: string;
  typeId: string;
  name: string;
  /** 발급일(ISO). 발급 시점 기록 전에 나간 레거시 장은 null */
  issuedAt: string | null;
  /** 만료일 'YYYY. M. D'. 무기한이거나 발급일 미상이면 null */
  expiry: string | null;
};

/**
 * 보유 쿠폰을 장 단위로 펼친다. 만료 임박한 순, 만료일 없는 장은 뒤로.
 *
 * `coupons[typeId]`가 개수의 정답이고 `couponIssuedAt[typeId]`는 그보다 짧을 수
 * 있다 — 발급 시점을 기록하기 전에 나간 장들이다. 모자란 만큼은 만료일 없이 채운다.
 */
export function buildCouponEntries(
  coupons: Record<string, number>,
  issuedAt: Record<string, string[]> | undefined,
  couponTypes: CouponType[],
  expiryDays: number,
): CouponEntry[] {
  const entries: CouponEntry[] = [];

  for (const ct of couponTypes) {
    const count = coupons[ct.id] ?? 0;
    const dates = issuedAt?.[ct.id] ?? [];
    for (let i = 0; i < count; i++) {
      const issued = dates[i] ?? null;
      entries.push({
        key: `${ct.id}-${i}`,
        typeId: ct.id,
        name: ct.name,
        issuedAt: issued,
        expiry:
          issued && expiryDays > 0
            ? dayjs(issued).add(expiryDays, 'day').format('YYYY. M. D')
            : null,
      });
    }
  }

  return entries.sort((a, b) => {
    if (a.issuedAt && b.issuedAt) return a.issuedAt.localeCompare(b.issuedAt);
    if (a.issuedAt) return -1;
    if (b.issuedAt) return 1;
    return 0;
  });
}

/**
 * CouponEntry.key → {typeId, index}. index는 `couponIssuedAt[typeId]` 배열의 위치다
 * (buildCouponEntries가 그 순서로 key를 매기므로 그대로 되짚을 수 있다).
 * 쿠폰 id에 '-'가 들어갈 수 있어서 마지막 '-'를 기준으로 자른다.
 */
export function parseCouponEntryKey(key: string): {
  typeId: string;
  index: number;
} {
  const at = key.lastIndexOf('-');
  return {typeId: key.slice(0, at), index: Number(key.slice(at + 1))};
}

/**
 * 관리자가 **고른 그 장**을 차감한다.
 *
 * 기존 removeCouponTimestamps는 타입별 개수만 받아 오래된 순(FIFO)으로 지웠다.
 * 화면이 장 단위 선택으로 바뀌면서, 체크한 줄과 실제로 빠지는 장의 만료일이
 * 어긋나면 안 되므로 인덱스를 지정해 지운다.
 *
 * 발급 시점이 기록되기 전에 나간 레거시 장(index >= dates.length)은 지울
 * 타임스탬프가 없다 — 개수만 줄어든다.
 */
export function removeCouponEntries(
  coupons: Record<string, number>,
  issuedAt: Record<string, string[]> | undefined,
  keys: string[],
): {
  coupons: Record<string, number>;
  issuedAt: Record<string, string[]>;
  usedByType: Record<string, number>;
} {
  const indicesByType = new Map<string, Set<number>>();
  for (const key of keys) {
    const {typeId, index} = parseCouponEntryKey(key);
    if (!indicesByType.has(typeId)) indicesByType.set(typeId, new Set());
    indicesByType.get(typeId)!.add(index);
  }

  const nextCoupons = {...coupons};
  const nextIssuedAt = {...(issuedAt ?? {})};
  const usedByType: Record<string, number> = {};

  for (const [typeId, indices] of indicesByType) {
    const dates = nextIssuedAt[typeId] ?? [];
    nextIssuedAt[typeId] = dates.filter((_, i) => !indices.has(i));
    nextCoupons[typeId] = Math.max(0, (coupons[typeId] ?? 0) - indices.size);
    usedByType[typeId] = indices.size;
  }

  return {coupons: nextCoupons, issuedAt: nextIssuedAt, usedByType};
}
