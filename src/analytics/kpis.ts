import dayjs from 'dayjs';

export interface PortfolioKpis {
  totalUsers: number;
  dau: number;
  wau: number;
  mau: number;
  retention7d: number; // 0~1
  retention7dSampleSize: number;
  avgVisitsPerUser: number;
  totalStampsEarned: number;
  totalCouponsIssued: number;
  totalCouponsRedeemed: number;
  couponRedemptionRate: number; // 0~1
  loyalRatio: number; // level >= 4
  loyalCount: number;
  churnedRatio: number; // last_used > 30 days
  churnedCount: number;
  activeRatio: number; // last_used <= 30 days
  activeCount: number;
}

type UserWithPhone = User & {phone: string};

/**
 * 운영중인 로그/유저 데이터로부터 바로 계산 가능한 포트폴리오 지표들.
 * 신규 analytics 이벤트가 쌓이기 전에도 성과를 정량화할 수 있는 "과거 회고 지표".
 */
interface KpiConfig {
  stampsPerCoupon?: number;
  loyalLevelThreshold?: number;
}

export function computePortfolioKpis(
  users: UserWithPhone[],
  logs: Log[],
  config?: KpiConfig,
): PortfolioKpis {
  const stampsPerCoupon = config?.stampsPerCoupon ?? 10;
  const loyalThreshold = config?.loyalLevelThreshold ?? 4;
  const now = dayjs();
  const totalUsers = users.length;

  // ── DAU / WAU / MAU (유니크 phone) ───────────────
  const savedLogs = logs.filter(l => l.action === 'stamp_saved');
  const usedLogs = logs.filter(l => l.action === 'stamp_used');

  const inWindow = (days: number) =>
    new Set(
      savedLogs
        .filter(l => now.diff(dayjs(l.timestamp), 'day') < days)
        .map(l => l.phone_number),
    ).size;
  const dau = inWindow(1);
  const wau = inWindow(7);
  const mau = inWindow(30);

  // ── 재방문율 (첫 방문 후 7일 이내 2회차 방문한 유저 비율) ──
  // 로그를 phone별로 묶어 timestamp 오름차순으로 정렬
  const visitsByPhone = new Map<string, number[]>();
  for (const l of savedLogs) {
    const arr = visitsByPhone.get(l.phone_number) ?? [];
    arr.push(new Date(l.timestamp).getTime());
    visitsByPhone.set(l.phone_number, arr);
  }
  let retainedWithin7d = 0;
  let retentionSample = 0;
  for (const [, times] of visitsByPhone) {
    if (times.length < 1) continue;
    retentionSample += 1;
    if (times.length < 2) continue;
    times.sort((a, b) => a - b);
    const first = times[0];
    const second = times[1];
    const diffDays = (second - first) / (1000 * 60 * 60 * 24);
    if (diffDays <= 7) retainedWithin7d += 1;
  }
  const retention7d =
    retentionSample > 0 ? retainedWithin7d / retentionSample : 0;

  // ── 평균 방문 빈도 (유저당 stamp_saved 건수) ──
  const avgVisitsPerUser =
    totalUsers > 0 ? savedLogs.length / totalUsers : 0;

  // ── 누적 적립 스탬프 ──
  const totalStampsEarned = savedLogs.reduce(
    (s, l) => s + (Number(l.stamp) || 0),
    0,
  );

  // ── 누적 쿠폰 발행 / 사용 ──
  // 현재 보유 + 이미 사용한 쿠폰 = 발행 총량
  const heldAmericano = users.reduce(
    (s, u) => s + (u.americanoCoupons ?? 0),
    0,
  );
  const heldBeverage = users.reduce((s, u) => s + (u.beverageCoupons ?? 0), 0);
  const heldTotal = heldAmericano + heldBeverage;

  // stamp_used 1건의 stamp 필드는 실제 소진 스탬프 수.
  const totalCouponsRedeemed = usedLogs.reduce(
    (s, l) => s + Math.floor((Number(l.stamp) || 0) / stampsPerCoupon),
    0,
  );
  const totalCouponsIssued = heldTotal + totalCouponsRedeemed;
  const couponRedemptionRate =
    totalCouponsIssued > 0 ? totalCouponsRedeemed / totalCouponsIssued : 0;

  // ── 충성 고객 (config 기반 임계값 이상) ──
  const loyalCount = users.filter(u => (u.level ?? 0) >= loyalThreshold).length;
  const loyalRatio = totalUsers > 0 ? loyalCount / totalUsers : 0;

  // ── 이탈 고객 (last_used > 30일 경과) / 활성 (<= 30일) ──
  let churnedCount = 0;
  let activeCount = 0;
  for (const u of users) {
    if (!u.last_used) {
      churnedCount += 1;
      continue;
    }
    const days = now.diff(dayjs(u.last_used), 'day');
    if (days > 30) churnedCount += 1;
    else activeCount += 1;
  }
  const churnedRatio = totalUsers > 0 ? churnedCount / totalUsers : 0;
  const activeRatio = totalUsers > 0 ? activeCount / totalUsers : 0;

  return {
    totalUsers,
    dau,
    wau,
    mau,
    retention7d,
    retention7dSampleSize: retentionSample,
    avgVisitsPerUser,
    totalStampsEarned,
    totalCouponsIssued,
    totalCouponsRedeemed,
    couponRedemptionRate,
    loyalRatio,
    loyalCount,
    churnedRatio,
    churnedCount,
    activeRatio,
    activeCount,
  };
}

export const fmtPct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const fmtInt = (x: number) => Math.round(x).toLocaleString('ko-KR');
export const fmtFloat = (x: number, digits = 1) =>
  x.toLocaleString('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
