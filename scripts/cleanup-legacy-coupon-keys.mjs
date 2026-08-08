/**
 * KB000001(카페 그랑) 고객 문서의 레거시 쿠폰 키를 정리한다.
 *
 * ── 배경 ────────────────────────────────────────────────────────────────
 * 이 매장은 쿠폰 id를 `americano`/`beverage` → `coupon_a`/`coupon_b`로 바꾼 적이
 * 있는데, 고객 문서의 `coupons` 맵에 옛 키가 남아 있다. 읽을 때는
 * `normalizeUser`가 옛 키를 새 id로 매핑해 주지만, 두 키가 **동시에** 존재하면
 * 결과가 객체 키 순회 순서에 좌우된다. 즉 사람마다 보이는 값이 달라질 수 있다.
 * 옛 키를 제거해 이 비결정성을 없앤다.
 *
 * ⚠️ 반드시 KB000001 한정이다.
 *    `americano`/`beverage`는 **다른 매장에서는 현역 쿠폰 id다.**
 *    (U7KUF4 = americano / 그 외 대부분 = americano, beverage)
 *    전역으로 돌리면 그 매장들의 쿠폰이 사라진다.
 *
 * ── 병합 규칙 ───────────────────────────────────────────────────────────
 * `beverage`와 `coupon_b`는 같은 쿠폰을 가리킨다(과거에 일치시킨 값). 따라서
 * 더하지 않고 **max**를 취한다. 더하면 같은 쿠폰을 두 번 세게 된다.
 * max를 쓰는 이유는 어느 쪽이 최신인지 보장할 수 없을 때 고객이 손해 보지
 * 않게 하기 위함이다.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────
 *   node scripts/cleanup-legacy-coupon-keys.mjs            # dry-run (기본)
 *   node scripts/cleanup-legacy-coupon-keys.mjs --apply    # 실제 반영
 *
 * 반영 전 대상 문서 전체를 `.backup-coupons-*.json`으로 저장한다. 되돌리려면
 * 그 파일의 `coupons`/`couponIssuedAt`을 그대로 다시 써 넣으면 된다.
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
const FieldValue = admin.firestore.FieldValue;

/** 이 매장에서 옛 키 → 새 id 대응 */
const KEY_MAP = [
  { legacy: "americano", current: "coupon_a" },
  { legacy: "beverage", current: "coupon_b" },
];

function hasLegacyKey(obj = {}) {
  return KEY_MAP.some(({ legacy }) => legacy in obj);
}

async function main() {
  // 매장 설정이 정말 coupon_a/coupon_b인지 먼저 확인한다.
  // 설정이 바뀐 뒤 이 스크립트를 다시 돌리면 데이터를 망가뜨릴 수 있다.
  const storeSnap = await db.doc(`stores/${STORE_CODE}`).get();
  const ids = (storeSnap.data()?.config?.couponTypes ?? []).map((c) => c.id);
  const expected = KEY_MAP.map((k) => k.current);
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    console.error(
      `❌ 중단: ${STORE_CODE}의 쿠폰 id가 예상과 다릅니다.\n` +
        `   예상 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(ids)}\n` +
        `   이 스크립트는 coupon_a/coupon_b 구성을 전제로 합니다.`,
    );
    process.exit(1);
  }

  const snapshot = await db
    .collection("users")
    .where("store_code", "==", STORE_CODE)
    .get();

  const targets = snapshot.docs.filter(
    (d) =>
      hasLegacyKey(d.data().coupons) || hasLegacyKey(d.data().couponIssuedAt),
  );

  if (targets.length === 0) {
    console.log("정리할 문서가 없습니다.");
    return;
  }

  let raised = 0;
  let gainedCoupons = 0;

  const updates = targets.map((doc) => {
    const data = doc.data();
    const coupons = data.coupons ?? {};
    const issuedAt = data.couponIssuedAt ?? {};
    const update = {};

    for (const { legacy, current } of KEY_MAP) {
      const merged = Math.max(coupons[current] ?? 0, coupons[legacy] ?? 0);
      if (merged !== (coupons[current] ?? 0)) {
        raised += 1;
        gainedCoupons += merged - (coupons[current] ?? 0);
      }
      update[`coupons.${current}`] = merged;
      if (legacy in coupons) update[`coupons.${legacy}`] = FieldValue.delete();

      // 발급 시점 배열도 함께 옮긴다. 남겨두면 만료 계산이 옛 키를 못 찾는다.
      if (legacy in issuedAt) {
        update[`couponIssuedAt.${current}`] = [
          ...(issuedAt[current] ?? []),
          ...(issuedAt[legacy] ?? []),
        ];
        update[`couponIssuedAt.${legacy}`] = FieldValue.delete();
      }
    }

    return { ref: doc.ref, update };
  });

  console.log(`대상 문서       : ${targets.length}건`);
  console.log(`값이 올라가는 건 : ${raised}건 (총 +${gainedCoupons}장)`);

  if (!APPLY) {
    console.log("\n[dry-run] 반영하지 않았습니다. --apply 를 붙여 실행하세요.");
    return;
  }

  const file = `.backup-coupons-${new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .slice(0, 15)}.json`;
  writeFileSync(
    file,
    JSON.stringify(
      targets.map((d) => ({ id: d.id, data: d.data() })),
      null,
      2,
    ),
  );
  console.log(`\n백업 저장: ${file}`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    updates
      .slice(i, i + BATCH_SIZE)
      .forEach(({ ref, update }) => batch.update(ref, update));
    await batch.commit();
    console.log(`  반영 ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
  }

  console.log("✅ 완료");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("실패:", e.message);
    process.exit(1);
  });
