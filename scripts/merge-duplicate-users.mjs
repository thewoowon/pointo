/**
 * 리셋된 고객 계정을 복구한다. (KB000001 한정)
 *
 * ── 무슨 일이 있었나 ────────────────────────────────────────────────────
 * 고객 문서 ID가 `{전화번호}` → `{전화번호}_{매장코드}`로 바뀌던 시기에,
 * 레거시 문서를 찾아주는 폴백(`_resolveUserDoc`)이 아직 없었다. 그 사이에
 * 방문한 고객은 "신규"로 판정되어 백지 문서가 새로 만들어졌고, 기존 스탬프·
 * 쿠폰·레벨이 옛 문서에 갇혔다. 예: 010-3699-6286 님은 레벨 9 · 쿠폰 20장을
 * 두고 2026-07-15에 레벨 0으로 다시 시작했다.
 *
 * 폴백이 추가된 뒤로는 새 중복이 생기지 않는다. 대상은 10명뿐이다.
 *
 * ── 복구 규칙 ───────────────────────────────────────────────────────────
 * stamps  : max(레거시 % spc, 복합 % spc)
 *           앱은 진행도를 `stamps % spc`로 보여준다. 그래서 단순히 더하면
 *           10명 중 5명이 오히려 **줄어든다.** 둘 중 나은 쪽을 취해 아무도
 *           손해 보지 않게 한다.
 * coupons : 레거시 + 복합 (합산)
 *           서로 다른 문서에 각각 쌓인 별개의 보유분이라 더하는 것이 맞다.
 *           같은 문서 안의 중복 키(beverage/coupon_b)와는 다른 상황이다.
 * level   : max — 등급이 내려가면 안 된다
 * created_at : 더 이른 쪽 — 실제 가입일
 * couponIssuedAt : 두 배열을 합쳐 시간순 정렬 (만료 계산 근거)
 *
 * 복구 후 레거시 문서는 삭제한다. 복합 문서가 진짜 계정이 된다.
 *
 * ⚠️ onUserDeleted Function이 배포된 뒤에는 이 스크립트를 그대로 쓰면 안 된다.
 *    사용자 문서 삭제가 그 고객의 로그 삭제를 유발한다. 배포 후에 돌려야 한다면
 *    삭제 대신 `merged: true` 표시만 남기도록 바꿀 것.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────
 *   node scripts/merge-duplicate-users.mjs            # dry-run
 *   node scripts/merge-duplicate-users.mjs --apply
 */

import { createRequire } from "module";
import { writeFileSync } from "fs";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

const STORE_CODE = "KB000001";
const APPLY = process.argv.includes("--apply");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const mask = (p) => `${p.slice(0, 3)}****${p.slice(-4)}`;
const stripSuffix = (id) => {
  const i = id.indexOf("_");
  return i === -1 ? id : id.slice(0, i);
};

function mergeCoupons(a = {}, b = {}) {
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) {
    out[key] = (out[key] ?? 0) + (value ?? 0);
  }
  return out;
}

function mergeIssuedAt(a = {}, b = {}) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = [...(a[key] ?? []), ...(b[key] ?? [])].sort();
  }
  return out;
}

async function main() {
  const storeSnap = await db.doc(`stores/${STORE_CODE}`).get();
  const spc = storeSnap.data()?.config?.stampsPerCoupon ?? 10;

  const snapshot = await db
    .collection("users")
    .where("store_code", "==", STORE_CODE)
    .get();

  const byPhone = new Map();
  for (const doc of snapshot.docs) {
    const phone = stripSuffix(doc.id);
    if (!byPhone.has(phone)) byPhone.set(phone, []);
    byPhone.get(phone).push(doc);
  }

  const pairs = [];
  for (const [phone, docs] of byPhone) {
    if (docs.length < 2) continue;
    const legacy = docs.find((d) => !d.id.includes("_"));
    const composite = docs.find((d) => d.id.includes("_"));
    if (legacy && composite) pairs.push({ phone, legacy, composite });
  }

  if (pairs.length === 0) {
    console.log("복구할 계정이 없습니다.");
    return;
  }

  console.log(`쿠폰당 스탬프: ${spc} | 복구 대상: ${pairs.length}명\n`);

  const plan = pairs.map(({ phone, legacy, composite }) => {
    const L = legacy.data();
    const C = composite.data();

    const stamps = Math.max((L.stamps ?? 0) % spc, (C.stamps ?? 0) % spc);
    const coupons = mergeCoupons(C.coupons, L.coupons);
    const merged = {
      stamps,
      level: Math.max(L.level ?? 0, C.level ?? 0),
      coupons,
      couponIssuedAt: mergeIssuedAt(C.couponIssuedAt, L.couponIssuedAt),
    };
    const createdAt = [L.created_at, C.created_at].filter(Boolean).sort()[0];
    if (createdAt) merged.created_at = createdAt;

    const before = {
      stamps: (C.stamps ?? 0) % spc,
      level: C.level ?? 0,
      coupons: Object.values(C.coupons ?? {}).reduce((s, v) => s + (v ?? 0), 0),
    };
    const after = {
      stamps: merged.stamps,
      level: merged.level,
      coupons: Object.values(coupons).reduce((s, v) => s + (v ?? 0), 0),
    };

    return { phone, legacy, composite, merged, before, after };
  });

  console.log("번호           | 진행도      | 레벨       | 쿠폰");
  for (const p of plan) {
    console.log(
      `${mask(p.phone)} | ${String(p.before.stamps).padStart(2)} → ${String(p.after.stamps).padStart(2)}     |` +
        ` ${String(p.before.level).padStart(2)} → ${String(p.after.level).padStart(2)}    |` +
        ` ${String(p.before.coupons).padStart(2)} → ${String(p.after.coupons).padStart(2)}`,
    );
  }

  const totalCoupons = plan.reduce(
    (s, p) => s + (p.after.coupons - p.before.coupons),
    0,
  );
  console.log(`\n돌려주는 쿠폰 합계: ${totalCoupons}장`);

  if (!APPLY) {
    console.log("\n[dry-run] 반영하지 않았습니다. --apply 를 붙여 실행하세요.");
    return;
  }

  const file = `.backup-merge-${new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .slice(0, 15)}.json`;
  writeFileSync(
    file,
    JSON.stringify(
      plan.map((p) => ({
        phone: p.phone,
        legacy: { id: p.legacy.id, data: p.legacy.data() },
        composite: { id: p.composite.id, data: p.composite.data() },
        merged: p.merged,
      })),
      null,
      2,
    ),
  );
  console.log(`\n백업 저장: ${file}`);

  for (const p of plan) {
    await p.composite.ref.update(p.merged);
    await p.legacy.ref.delete();
    // terms 문서도 복합 ID 쪽으로 정리 (없으면 무시)
    await db.doc(`terms/${p.legacy.id}`).delete().catch(() => {});
    console.log(`  복구 ${mask(p.phone)}`);
  }

  console.log("✅ 완료");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("실패:", e.message);
    process.exit(1);
  });
