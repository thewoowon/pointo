/**
 * 데모/촬영용 매장에 그럴듯한 운영 데이터를 채워 넣는다.
 *
 * 왜: 기능 촬영을 하려는데 새 매장은 전부 0이라 화면이 비어 보인다. 통계·적립내역·
 * 고객 대시보드가 실제 매장처럼 보이려면 고객·로그·쿠폰이 서로 앞뒤가 맞아야 한다
 * (예: 쿠폰 3장을 들고 있으려면 스탬프 30개를 찍은 이력이 있어야 한다).
 * 그래서 숫자를 흩뿌리는 대신 **앱의 적립 로직을 그대로 재현해서** 만든다 —
 * useGivePoint.handleApprove와 같은 계산이라 어느 화면을 열어도 값이 맞는다.
 *
 * 안전장치: 대상 매장을 코드로 못 박고, 소유자 uid까지 확인한 뒤에만 쓴다.
 * 운영 매장에 실수로 도는 일은 없다.
 *
 *   node scripts/seed-demo-data.mjs                  # 미리보기 (아무것도 안 씀)
 *   node scripts/seed-demo-data.mjs --apply          # 기존 데이터 위에 추가
 *   node scripts/seed-demo-data.mjs --reset --apply  # 싹 지우고 새로 (권장)
 *
 * 촬영 날 아침에 --reset --apply로 다시 돌리면 "오늘" 데이터가 그날 기준으로
 * 새로 잡힌다. 날짜가 지난 데이터로 찍으면 오늘 현황이 전부 0이 된다.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const apply = process.argv.includes("--apply");
const reset = process.argv.includes("--reset");

// ─── 대상 매장 (데모 전용) ────────────────────────────────────────
const STORE_CODE = "IADLDJ";
const OWNER_UID = "PQbrI6IqdLUliDtnTFsYeh4zZou2";
const OWNER_EMAIL = "demoforpointo@gmail.com";

// ─── 매장 설정 (config 없는 매장의 폴백과 동일 — useStoreConfig 참고) ───
const SPC = 10; // stampsPerCoupon
const COUPON_SEQ = ["americano", "beverage"];
const COUPON_NAMES = { americano: "아메리카노 쿠폰", beverage: "음료 쿠폰" };
const LEVEL_UP_ON = "americano";
const RECENT_LOG_LIMIT = 10;

// ─── 촬영 시나리오용 고객 ─────────────────────────────────────────
/** 스탬프 6개 — 촬영하면서 +1 적립하는 대상 */
const FILM_STAMP_PHONE = "01012345678";
/** 쿠폰 1장 보유 — 관리자에서 사용 처리하는 대상 */
const FILM_COUPON_PHONE = "01034567890";

// ─── 목표치 (요청 사양) ───────────────────────────────────────────
const TARGET = {
  customers: 28,
  recent30Saved: 190, // 최근 30일 적립 로그 건수
  todaySaved: 13,
  todayUsed: 2,
  todayVisitors: 8,
  historyUses: 8, // 오늘 이전 30일 내 쿠폰 사용 (+ 오늘 2건 = 총 10건)
};

// ─── 결정론적 난수 ────────────────────────────────────────────────
// 같은 시드 = 같은 데이터. 다시 돌려도 성격이 확 달라지지 않는다.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260816);
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];

// ─── 날짜 유틸 (전부 로컬 시간 기준 = 앱이 보는 시간) ───────────────
const NOW = new Date();
const startOfToday = () => {
  const d = new Date(NOW);
  d.setHours(0, 0, 0, 0);
  return d;
};
/** n일 전 특정 시각 */
const at = (daysAgo, hour, minute) => {
  const d = startOfToday();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, randInt(0, 59), 0);
  return d;
};
const ymd = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** 카페 방문이 몰리는 시간대 — 시간대별 차트가 밋밋하지 않도록 가중치를 준다 */
const VISIT_HOURS = [7, 8, 8, 9, 9, 10, 11, 12, 12, 13, 13, 14, 15, 16, 17, 18, 19];

// ─── 고객 상태 시뮬레이터 (useGivePoint.handleApprove와 동일한 계산) ───

function createCustomer(phone, segment, { createdDaysAgo, level, stamps }) {
  return {
    phone,
    segment,
    docId: `${phone}_${STORE_CODE}`,
    createdAt: ymd(at(createdDaysAgo, 12, 0)),
    createdDaysAgo,
    level,
    stamps,
    phase: COUPON_SEQ[0],
    coupons: { americano: 0, beverage: 0 },
    couponIssuedAt: { americano: [], beverage: [] },
    recentLogs: [],
    lastUsed: null,
    logs: [],
  };
}

/** 스탬프 적립 1건. 쿠폰 발급·레벨업까지 앱과 동일하게 처리한다. */
function earn(customer, count, when) {
  const current = customer.stamps % SPC;
  const after = current + count;
  const issued = Math.floor(after / SPC);
  customer.stamps = after % SPC;

  for (let i = 0; i < issued; i++) {
    const idx = COUPON_SEQ.indexOf(customer.phase);
    customer.coupons[customer.phase] += 1;
    customer.couponIssuedAt[customer.phase].push(when.toISOString());
    if (customer.phase === LEVEL_UP_ON) customer.level += 1;
    customer.phase = COUPON_SEQ[(idx + 1) % COUPON_SEQ.length];
  }

  customer.logs.push({
    action: "stamp_saved",
    phone_number: customer.phone,
    stamp: count,
    timestamp: when,
    note: "",
    store_code: STORE_CODE,
    user_level: customer.level,
    coupons_issued: issued,
    mode: "stamp",
  });
  pushRecent(customer, {
    action: "stamp_saved",
    amount: count,
    at: when.toISOString(),
    ...(issued > 0 ? { note: `쿠폰 ${issued}장 획득` } : {}),
  });
  customer.lastUsed = ymd(when);
  return issued;
}

/** 보유 쿠폰 1장 사용. 스탬프는 건드리지 않는다(스탬프 카드 모델). */
function redeem(customer, when) {
  const typeId = COUPON_SEQ.find((id) => customer.coupons[id] > 0);
  if (!typeId) return false;

  customer.coupons[typeId] -= 1;
  customer.couponIssuedAt[typeId].shift();
  const note = `${COUPON_NAMES[typeId]} 1장`;

  customer.logs.push({
    action: "stamp_used",
    phone_number: customer.phone,
    stamp: 0,
    timestamp: when,
    note,
    store_code: STORE_CODE,
    user_level: customer.level,
    coupons_redeemed: 1,
    mode: "stamp",
  });
  pushRecent(customer, {
    action: "stamp_used",
    amount: 1,
    at: when.toISOString(),
    note,
  });
  customer.lastUsed = ymd(when);
  return true;
}

function pushRecent(customer, entry) {
  customer.recentLogs.unshift(entry);
  customer.recentLogs = customer.recentLogs.slice(0, RECENT_LOG_LIMIT);
}

// ─── 고객 생성 ────────────────────────────────────────────────────

/** 010 + 8자리. 촬영용 번호와 겹치지 않게 고유 번호를 뽑는다. */
function makePhones(count, taken) {
  const phones = [];
  while (phones.length < count) {
    const p = `010${randInt(2000, 9999)}${randInt(1000, 9999)}`;
    if (taken.has(p)) continue;
    taken.add(p);
    phones.push(p);
  }
  return phones;
}

const taken = new Set([FILM_STAMP_PHONE, FILM_COUPON_PHONE]);

/**
 * 세그먼트 구성 — 통계의 충성/활성/이탈이 모두 0이 아니게 섞는다.
 *   loyal   : 레벨 4↑ (충성 고객), 주 3~4회 방문
 *   regular : 레벨 1~3, 주 1~2회 방문
 *   fresh   : 최근 가입, 방문 1~3회
 *   churned : 두 달 넘게 발길 끊김 (이탈 고객)
 */
// stamps(시작 스탬프)는 로그 창(30일) 이전에 찍힌 판의 잔량이다. 이 값이 높을수록
// 창 안에서 판이 더 자주 완성돼 쿠폰 발행량이 뛴다 — 요청치(15~20장)에 맞춰 낮게 잡았다.
const SEGMENTS = [
  { name: "loyal", count: 5, createdDaysAgo: [180, 320], level: [4, 6], visits: [12, 17], stamps: [0, 5], dayRange: [1, 29] },
  { name: "regular", count: 7, createdDaysAgo: [60, 170], level: [1, 3], visits: [5, 10], stamps: [0, 4], dayRange: [1, 29] },
  // 발길이 뜸해지는 중 — 최근 일주일엔 안 왔다. WAU와 MAU가 벌어지게 만드는 층이다.
  { name: "lapsing", count: 3, createdDaysAgo: [80, 200], level: [1, 2], visits: [3, 5], stamps: [0, 4], dayRange: [9, 29] },
  { name: "fresh", count: 5, createdDaysAgo: [2, 18], level: [0, 0], visits: [1, 3], stamps: [0, 2], dayRange: [1, 29] },
  { name: "churned", count: 6, createdDaysAgo: [150, 330], level: [0, 2], visits: [0, 0], stamps: [0, 7], dayRange: [1, 29] },
];

const customers = [];
for (const seg of SEGMENTS) {
  for (const phone of makePhones(seg.count, taken)) {
    customers.push(
      createCustomer(phone, seg.name, {
        createdDaysAgo: randInt(...seg.createdDaysAgo),
        level: randInt(...seg.level),
        stamps: randInt(...seg.stamps),
      }),
    );
  }
}

// 촬영용 두 명은 상태를 정확히 맞춰야 해서 따로 만든다.
const filmStamp = createCustomer(FILM_STAMP_PHONE, "film", {
  createdDaysAgo: 47,
  level: 2,
  stamps: 0,
});
const filmCoupon = createCustomer(FILM_COUPON_PHONE, "film", {
  createdDaysAgo: 96,
  level: 1,
  stamps: 0,
});
customers.push(filmStamp, filmCoupon);

// ─── 방문 이력 생성 ───────────────────────────────────────────────

/** 최근 30일(오늘 제외) 안에서 서로 다른 날 n개 뽑기 */
function visitDays(n, from = 1, to = 29) {
  const days = new Set();
  let guard = 0;
  while (days.size < n && guard++ < 200) days.add(randInt(from, to));
  return [...days].sort((a, b) => b - a); // 오래된 날 → 최근 날
}

const events = []; // {customer, kind, when, count}

for (const c of customers) {
  if (c.segment === "churned") {
    // 이탈 고객: 60~150일 전에만 흔적을 남긴다 (last_used가 30일을 넘겨야 이탈로 잡힌다)
    const days = new Set();
    for (let i = 0; i < randInt(3, 6); i++) days.add(randInt(60, 150));
    for (const d of [...days].sort((a, b) => b - a)) {
      events.push({ customer: c, kind: "earn", when: at(d, pick(VISIT_HOURS), randInt(0, 59)), count: 1 });
    }
    continue;
  }
  if (c.segment === "film") continue; // 아래에서 따로 조립

  const seg = SEGMENTS.find((s) => s.name === c.segment);
  const n = randInt(...seg.visits);
  const [oldest, newest] = [Math.min(seg.dayRange[1], c.createdDaysAgo), seg.dayRange[0]];
  for (const d of visitDays(n, newest, Math.max(newest, oldest))) {
    events.push({
      customer: c,
      kind: "earn",
      when: at(d, pick(VISIT_HOURS), randInt(0, 59)),
      // 가끔 두 잔 — 적립 수량이 전부 1이면 상세 화면이 심심하다
      count: rand() < 0.12 ? 2 : 1,
    });
  }
}

// 촬영용 #1: 스탬프가 정확히 6개로 끝나야 한다 → 쿠폰을 넘기지 않는 6회 방문
for (const d of [26, 21, 17, 12, 8, 3]) {
  events.push({ customer: filmStamp, kind: "earn", when: at(d, pick(VISIT_HOURS), randInt(0, 59)), count: 1 });
}
// 촬영용 #2: 쿠폰 1장을 들고 있어야 한다 → 판을 채워 쿠폰을 받고 새 판에 2개
for (const d of [27, 24, 22, 19, 16, 14, 11, 9, 6, 4, 3, 2]) {
  events.push({ customer: filmCoupon, kind: "earn", when: at(d, pick(VISIT_HOURS), randInt(0, 59)), count: 1 });
}

// 최근 30일 적립 건수를 목표치에 맞춘다 (요청: 180~200건)
const recentEarns = () => events.filter((e) => e.kind === "earn" && e.when >= at(29, 0, 0)).length;
const flexible = customers.filter((c) => c.segment === "loyal" || c.segment === "regular");
let guard = 0;
while (recentEarns() + TARGET.todaySaved < TARGET.recent30Saved && guard++ < 500) {
  const c = pick(flexible);
  events.push({ customer: c, kind: "earn", when: at(randInt(1, 29), pick(VISIT_HOURS), randInt(0, 59)), count: 1 });
}
while (recentEarns() + TARGET.todaySaved > TARGET.recent30Saved && guard++ < 500) {
  const idx = events.findIndex(
    (e) => e.kind === "earn" && flexible.includes(e.customer) && e.when >= at(29, 0, 0),
  );
  if (idx === -1) break;
  events.splice(idx, 1);
}

// ─── 과거 이벤트 시뮬레이션 (시간순) ──────────────────────────────
events.sort((a, b) => a.when - b.when);

let historyUses = 0;
for (const e of events) {
  earn(e.customer, e.count, e.when);

  // 쿠폰을 들고 있으면 며칠 뒤 쓰러 온다. 촬영용 두 명은 상태를 지켜야 하므로 제외.
  const holds = COUPON_SEQ.some((id) => e.customer.coupons[id] > 0);
  if (
    holds &&
    historyUses < TARGET.historyUses &&
    e.customer.segment !== "film" &&
    rand() < 0.55
  ) {
    const daysAgo = Math.max(1, Math.floor((startOfToday() - e.when) / 86400000) - randInt(0, 3));
    const when = at(daysAgo, pick(VISIT_HOURS), randInt(0, 59));
    if (when > e.when && redeem(e.customer, when)) historyUses += 1;
  }
}

// ─── 오늘 ─────────────────────────────────────────────────────────
// 방문 8명 / 적립 13건 / 쿠폰 사용 2건. 시간대가 골고루 퍼지도록 직접 배치한다.

const activePool = customers.filter(
  (c) => c.segment === "loyal" || c.segment === "regular" || c.segment === "fresh",
);
// 쿠폰을 이미 들고 있거나 한 잔이면 채우는 고객을 먼저 — 오늘 '사용' 2건을 만들 사람들
const redeemers = activePool
  .filter((c) => COUPON_SEQ.some((id) => c.coupons[id] > 0) || c.stamps >= SPC - 2)
  .slice(0, 2);
const others = activePool.filter((c) => !redeemers.includes(c)).slice(0, TARGET.todayVisitors - redeemers.length);
const todayVisitors = [...redeemers, ...others];

if (todayVisitors.length < TARGET.todayVisitors) {
  throw new Error("오늘 방문 고객을 채울 활성 고객이 부족합니다.");
}

// 13건을 시간대에 흩뿌린다 — 12~15시가 피크가 되도록
const TODAY_SLOTS = [
  [7, 40], [8, 15], [9, 5], [9, 50], [10, 30],
  [11, 20], [12, 10], [12, 45], [13, 15], [13, 55],
  [15, 30], [16, 40], [18, 20],
];
const todayOrder = [
  todayVisitors[0], todayVisitors[1], todayVisitors[2], todayVisitors[3],
  todayVisitors[4], todayVisitors[5], todayVisitors[6], todayVisitors[7],
  todayVisitors[2], todayVisitors[0], todayVisitors[4], todayVisitors[6], todayVisitors[1],
];

TODAY_SLOTS.forEach(([hour, minute], i) => {
  const c = todayOrder[i];
  const isRedeemer = redeemers.includes(c);
  const holds = COUPON_SEQ.some((id) => c.coupons[id] > 0);
  // 쿠폰 사용을 찍을 고객인데 아직 쿠폰이 없으면, 오늘 판을 채워서 받는다.
  const count = isRedeemer && !holds ? SPC - (c.stamps % SPC) : rand() < 0.12 ? 2 : 1;
  earn(c, count, at(0, hour, minute));
});

let todayUses = 0;
for (const c of redeemers) {
  const when = at(0, c === redeemers[0] ? 13 : 16, randInt(10, 50));
  if (redeem(c, when)) todayUses += 1;
}

// ─── 검증 ─────────────────────────────────────────────────────────

const allLogs = customers.flatMap((c) => c.logs);
const since30 = at(29, 0, 0);
const savedLogs = allLogs.filter((l) => l.action === "stamp_saved");
const usedLogs = allLogs.filter((l) => l.action === "stamp_used");
const recent30 = savedLogs.filter((l) => l.timestamp >= since30);
const todayLogs = allLogs.filter((l) => l.timestamp >= startOfToday());

const heldTotal = customers.reduce(
  (s, c) => s + COUPON_SEQ.reduce((t, id) => t + c.coupons[id], 0),
  0,
);
const redeemedTotal = usedLogs.length;
const loyal = customers.filter((c) => c.level >= 4).length;
const churned = customers.filter(
  (c) => !c.lastUsed || (startOfToday() - new Date(c.lastUsed)) / 86400000 > 30,
).length;

// 촬영 시나리오는 어긋나면 촬영이 망하므로 강하게 확인한다.
const assert = (ok, msg) => {
  if (!ok) throw new Error(`시나리오 검증 실패: ${msg}`);
};
assert(filmStamp.stamps === 6, `${FILM_STAMP_PHONE} 스탬프가 6이 아님 (${filmStamp.stamps})`);
assert(
  COUPON_SEQ.reduce((s, id) => s + filmCoupon.coupons[id], 0) === 1,
  `${FILM_COUPON_PHONE} 쿠폰이 1장이 아님`,
);
assert(todayUses === TARGET.todayUsed, `오늘 쿠폰 사용 ${todayUses}건`);
assert(loyal > 0 && churned > 0, "충성/이탈 고객이 비어 있음");

/**
 * 통계 화면 '종합 성과'가 이 데이터로 뽑을 값. src/analytics/kpis.ts와 같은 계산이다.
 * (앱 코드를 그대로 import할 수 없어 옮겨 적었다 — 여기 숫자는 확인용이고,
 *  화면에 실제로 그리는 건 언제나 앱 쪽 계산이다)
 */
function previewKpis() {
  const days = (d) => (NOW - d) / 86400000;
  const uniqueWithin = (n) =>
    new Set(savedLogs.filter((l) => days(l.timestamp) < n).map((l) => l.phone_number)).size;

  const visits = new Map();
  for (const l of savedLogs) {
    visits.set(l.phone_number, [...(visits.get(l.phone_number) ?? []), l.timestamp.getTime()]);
  }
  let retained = 0;
  for (const [, times] of visits) {
    if (times.length < 2) continue;
    times.sort((a, b) => a - b);
    if ((times[1] - times[0]) / 86400000 <= 7) retained += 1;
  }

  return {
    dau: uniqueWithin(1),
    wau: uniqueWithin(7),
    mau: uniqueWithin(30),
    retention7d: retained / visits.size,
    retentionSample: visits.size,
    avgVisits: savedLogs.length / customers.length,
    totalStamps: savedLogs.reduce((s, l) => s + l.stamp, 0),
  };
}

const hourBlocks = [[6, 9], [9, 12], [12, 15], [15, 18], [18, 21], [21, 24]];

console.log(`\n📦 데모 데이터 미리보기 — ${STORE_CODE} (${OWNER_EMAIL})\n`);
console.log(`  고객            ${customers.length}명 (충성 ${loyal} / 활성 ${customers.length - churned} / 이탈 ${churned})`);
console.log(`  전체 로그       ${allLogs.length}건 (적립 ${savedLogs.length} / 사용 ${usedLogs.length})`);
console.log(`  최근 30일 적립  ${recent30.length}건`);
console.log(`  쿠폰            발행 ${heldTotal + redeemedTotal}장 (보유 ${heldTotal} + 사용 ${redeemedTotal}) · 사용률 ${((redeemedTotal / (heldTotal + redeemedTotal)) * 100).toFixed(1)}%`);
console.log(`  오늘            방문 ${new Set(todayLogs.map((l) => l.phone_number)).size}명 / 적립 ${todayLogs.filter((l) => l.action === "stamp_saved").length}건 / 사용 ${todayLogs.filter((l) => l.action === "stamp_used").length}건 (목록 ${todayLogs.length}줄)`);
console.log(
  `  오늘 시간대     ${hourBlocks
    .map(([f, t]) => `${f}~${t}시 ${todayLogs.filter((l) => l.timestamp.getHours() >= f && l.timestamp.getHours() < t).length}`)
    .join(" · ")}`,
);
const k = previewKpis();
console.log("\n  [통계 · 종합 성과 예상값]");
console.log(`  누적 가입자 ${customers.length}명 · 누적 스탬프 ${k.totalStamps}개`);
console.log(`  DAU ${k.dau} / WAU ${k.wau} / MAU ${k.mau}`);
console.log(`  평균 방문 빈도 ${k.avgVisits.toFixed(1)}회/인 · D7 재방문 ${(k.retention7d * 100).toFixed(1)}% (n=${k.retentionSample})`);
console.log(`  충성 ${((loyal / customers.length) * 100).toFixed(1)}% · 활성 ${(((customers.length - churned) / customers.length) * 100).toFixed(1)}% · 이탈 ${((churned / customers.length) * 100).toFixed(1)}%`);

console.log(`\n  🎬 ${FILM_STAMP_PHONE} — 스탬프 ${filmStamp.stamps}/${SPC}, 레벨 ${filmStamp.level} (여기서 +1 적립 촬영)`);
console.log(`  🎬 ${FILM_COUPON_PHONE} — ${COUPON_SEQ.map((id) => `${COUPON_NAMES[id]} ${filmCoupon.coupons[id]}장`).join(", ")}, 스탬프 ${filmCoupon.stamps}/${SPC} (쿠폰 사용 촬영)\n`);

// ─── 쓰기 ─────────────────────────────────────────────────────────

async function assertDemoStore() {
  const snap = await db.doc(`stores/${STORE_CODE}`).get();
  if (!snap.exists) throw new Error(`매장 ${STORE_CODE}가 없습니다.`);
  if (snap.data().ownerId !== OWNER_UID) {
    throw new Error(
      `매장 ${STORE_CODE}의 소유자가 데모 계정이 아닙니다. 운영 매장일 수 있어 중단합니다.`,
    );
  }
}

/** 문서 배열을 500개 제한에 맞춰 나눠 커밋 */
async function commitAll(ops) {
  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + CHUNK)) op(batch);
    await batch.commit();
  }
}

async function wipe() {
  const [users, logs] = await Promise.all([
    db.collection("users").where("store_code", "==", STORE_CODE).get(),
    db.collection("logs").where("store_code", "==", STORE_CODE).get(),
  ]);
  const ops = [];
  for (const d of users.docs) {
    ops.push((b) => b.delete(d.ref));
    ops.push((b) => b.delete(db.doc(`terms/${d.id}`)));
  }
  for (const d of logs.docs) ops.push((b) => b.delete(d.ref));
  await commitAll(ops);
  console.log(`🧹 기존 데이터 삭제: 고객 ${users.size}명 / 로그 ${logs.size}건`);
}

async function seed() {
  const ops = [];

  for (const c of customers) {
    ops.push((b) =>
      b.set(db.doc(`users/${c.docId}`), {
        created_at: c.createdAt,
        last_used: c.lastUsed ?? c.createdAt,
        level: c.level,
        stamps: c.stamps,
        points: 0,
        phase: c.phase,
        coupons: c.coupons,
        couponIssuedAt: c.couponIssuedAt,
        recentLogs: c.recentLogs,
        hasRated: true,
        store_code: STORE_CODE,
      }),
    );
    ops.push((b) =>
      b.set(db.doc(`terms/${c.docId}`), {
        agreed: true,
        date: `${c.createdAt}T09:00:00.000Z`,
      }),
    );
  }

  for (const log of allLogs) {
    ops.push((b) =>
      b.set(db.collection("logs").doc(), {
        ...log,
        timestamp: admin.firestore.Timestamp.fromDate(log.timestamp),
      }),
    );
  }

  // 매장 마지막 사용일 + 대기 중인 고객 세션 초기화 (촬영 시작 화면이 깨끗하도록)
  ops.push((b) => b.update(db.doc(`stores/${STORE_CODE}`), { last_logged: ymd(NOW) }));
  ops.push((b) =>
    b.set(db.doc(`sessions/session_${STORE_CODE}`), {
      is_confirmed: false,
      last_used: ymd(NOW),
      phone: "",
      mode: "waiting",
    }),
  );

  await commitAll(ops);
  console.log(`✅ 적재 완료: 고객 ${customers.length}명 / 로그 ${allLogs.length}건`);
}

if (!apply) {
  console.log("ℹ️  미리보기입니다. 실제로 넣으려면 --reset --apply 를 붙여 다시 실행하세요.\n");
  process.exit(0);
}

await assertDemoStore();
if (reset) await wipe();
await seed();
process.exit(0);
