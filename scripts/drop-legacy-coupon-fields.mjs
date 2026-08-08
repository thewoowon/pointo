/**
 * 고객 문서에서 최상위 레거시 쿠폰 필드를 제거한다.
 *
 *   americanoCoupons, beverageCoupons
 *
 * ── 배경 ────────────────────────────────────────────────────────────────
 * `coupons` 맵이 생기기 전의 표현이다. 이후에도 하위 호환을 위해 계속 기록해
 * 왔지만, 이제 모든 문서가 `coupons` 맵을 갖고 있어(1,517/1,517) 읽기 폴백이
 * 죽은 코드가 됐다. 앱 코드에서 읽기·쓰기를 모두 제거했으므로 데이터도 지운다.
 *
 * ⚠️ 배포 순서 주의
 *    App Store의 **구버전 앱은 아직 이 필드를 기록한다.** 그래서 지금 지워도
 *    구버전으로 적립하는 고객에게는 다시 생긴다. 신버전 배포가 끝난 뒤 한 번 더
 *    돌려야 완전히 사라진다. (지금 돌려도 해는 없다 — 읽는 쪽이 없다)
 *
 * ── 실행 ────────────────────────────────────────────────────────────────
 *   node scripts/drop-legacy-coupon-fields.mjs            # dry-run
 *   node scripts/drop-legacy-coupon-fields.mjs --apply
 */

import { createRequire } from "module";
import { writeFileSync } from "fs";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

const APPLY = process.argv.includes("--apply");
const FIELDS = ["americanoCoupons", "beverageCoupons"];

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function main() {
  const snapshot = await db.collection("users").get();

  // 안전장치: coupons 맵이 없는 문서가 있으면 그 문서는 레거시 필드가 유일한
  // 쿠폰 정보다. 지우면 쿠폰이 사라지므로 건너뛰고 보고한다.
  const risky = snapshot.docs.filter((d) => !d.data().coupons);
  const targets = snapshot.docs.filter(
    (d) => d.data().coupons && FIELDS.some((f) => d.data()[f] != null),
  );

  console.log(`전체 ${snapshot.size}건 중 대상 ${targets.length}건`);
  if (risky.length > 0) {
    console.log(
      `⚠️  coupons 맵이 없어 건너뛴 문서: ${risky.length}건 ` +
        `(${risky.map((d) => d.id).join(", ")})`,
    );
  }

  if (targets.length === 0) return;

  if (!APPLY) {
    console.log("\n[dry-run] 반영하지 않았습니다. --apply 를 붙여 실행하세요.");
    return;
  }

  const file = `.backup-legacyfields-${new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .slice(0, 15)}.json`;
  writeFileSync(
    file,
    JSON.stringify(
      targets.map((d) => ({
        id: d.id,
        americanoCoupons: d.data().americanoCoupons ?? null,
        beverageCoupons: d.data().beverageCoupons ?? null,
      })),
      null,
      2,
    ),
  );
  console.log(`백업 저장: ${file}`);

  const BATCH_SIZE = 400;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = db.batch();
    targets.slice(i, i + BATCH_SIZE).forEach((d) => {
      batch.update(
        d.ref,
        Object.fromEntries(FIELDS.map((f) => [f, FieldValue.delete()])),
      );
    });
    await batch.commit();
    console.log(`  반영 ${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length}`);
  }

  console.log("✅ 완료");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("실패:", e.message);
    process.exit(1);
  });
