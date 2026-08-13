/**
 * 포인트 잔액을 stamps → points 필드로 옮긴다. (포인트 모드 매장 한정)
 *
 * 왜: 예전엔 두 모드가 users.stamps 하나를 공유했다. 그래서 포인트 매장이
 * 스탬프 모드로 바뀌면 적립 로직의 `stamps % stampsPerCoupon`이 34만 포인트를
 * 한 자리 수로 잘라버렸다 — 복구 불가능한 잔액 증발. 이제 포인트는 points에만
 * 쌓이고, 이 스크립트가 기존 문서를 새 필드로 넘긴다.
 *
 * ⚠️ 실행 시점: **앱 신버전이 매장 기기에 모두 깔린 뒤.**
 *    구버전 앱은 여전히 stamps만 읽는다. 먼저 돌리면(=stamps를 0으로 비우면)
 *    업데이트 안 한 키오스크에서 고객 잔액이 0으로 보인다.
 *    신버전은 points가 없으면 stamps로 폴백하므로, 백필 전에도 정상 동작한다.
 *
 * 그 시점을 사람이 기억할 필요는 없다 — 스크립트가 직접 확인한다. 신버전만
 * 로그에 `mode`를 남기므로, 매장의 최근 로그가 전부 mode를 갖고 있으면 그
 * 매장에서 적립하는 기기는 업데이트된 것이다. 하나라도 없으면 --apply를
 * 거부한다. (한계: '적립이 일어난 기기'만 증명한다. 기기가 여럿인 매장에서
 * 한 대가 놀고 있으면 잡아내지 못한다)
 *
 *   node scripts/migrate-points-field.mjs           # 미리보기 + 준비 상태 점검
 *   node scripts/migrate-points-field.mjs --apply   # 실제 반영 (가드 통과 시)
 *   node scripts/migrate-points-field.mjs --apply --force   # 가드 무시
 *
 * 이미 points가 있는 문서는 건드리지 않아서 여러 번 돌려도 안전하다.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

/** 준비 상태를 판단할 때 들여다볼 최근 로그 건수 */
const RECENT_LOG_SAMPLE = 20;

/**
 * 이 매장에서 적립하는 기기가 신버전인지 확인한다.
 *
 * `store_code`로만 거르고 정렬은 메모리에서 한다 — where + orderBy는 복합
 * 인덱스를 요구하는데, 이 프로젝트엔 인덱스 정의가 없어서 쿼리가 실패한다.
 * 매장 하나치 로그라 일회성 스크립트에는 이 편이 안전하다.
 */
async function checkDevices(storeId) {
  const snap = await db.collection("logs").where("store_code", "==", storeId).get();

  const recent = snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0))
    .slice(0, RECENT_LOG_SAMPLE);

  if (recent.length === 0) {
    return { ok: false, reason: "적립 로그가 없어 기기 버전을 확인할 수 없음" };
  }

  const legacy = recent.filter((l) => l.mode === undefined);
  if (legacy.length > 0) {
    const at = legacy[0].timestamp?.toDate?.();
    return {
      ok: false,
      reason:
        `최근 ${recent.length}건 중 ${legacy.length}건에 mode가 없음 — 구버전 앱이 아직 적립 중` +
        (at ? ` (가장 최근: ${at.toLocaleString("ko-KR")})` : ""),
    };
  }

  return { ok: true, reason: `최근 ${recent.length}건 모두 mode 있음` };
}

const stores = await db.collection("stores").get();
const pointStores = stores.docs.filter((s) => s.data().config?.mode === "point");

if (pointStores.length === 0) {
  console.log("포인트 모드 매장이 없습니다. 할 일 없음.");
  process.exit(0);
}

console.log(
  `포인트 모드 매장 ${pointStores.length}곳: ${pointStores
    .map((s) => `${s.id}(${s.data().name ?? "?"})`)
    .join(", ")}\n`
);

// ── 가드: 매장 기기가 신버전인지 먼저 본다 ──
console.log("기기 버전 점검 (로그의 mode 필드로 판단)");
const blocked = [];
for (const store of pointStores) {
  const result = await checkDevices(store.id);
  console.log(`  ${result.ok ? "✅" : "⛔"} ${store.id} — ${result.reason}`);
  if (!result.ok) blocked.push(store.id);
}
console.log("");

if (blocked.length > 0 && apply && !force) {
  console.error(
    `⛔ ${blocked.join(", ")} — 아직 준비되지 않아 반영을 중단합니다.\n` +
      `   지금 stamps를 비우면 구버전 앱에서 고객 잔액이 0으로 보입니다.\n` +
      `   앱 업데이트를 기다렸다가 다시 돌리거나, 확신이 있으면 --force를 붙이세요.`
  );
  process.exit(1);
}

if (blocked.length > 0 && apply && force) {
  console.warn(`⚠️  --force: ${blocked.join(", ")}의 가드를 무시하고 진행합니다.\n`);
}

let totalMoved = 0;
let totalSkipped = 0;

for (const store of pointStores) {
  const users = await db
    .collection("users")
    .where("store_code", "==", store.id)
    .get();

  let batch = db.batch();
  let pending = 0;
  let moved = 0;
  let cleaned = 0;
  let skipped = 0;
  let sum = 0;

  for (const u of users.docs) {
    const d = u.data();
    const update = {};

    if (d.points === undefined) {
      // 아직 안 옮긴 문서 — 잔액이 stamps에 있다
      update.points = d.stamps ?? 0;
      sum += d.stamps ?? 0;
      moved += 1;
    } else if ((d.stamps ?? 0) !== 0) {
      // 신버전 앱이 이미 points를 썼지만 옛 stamps 값이 남은 문서
      cleaned += 1;
    } else {
      skipped += 1;
      continue;
    }

    // 포인트 매장에서 stamps는 의미가 없다. 남겨두면 나중에 스탬프 모드로
    // 전환했을 때 34만이 스탬프 개수로 해석된다.
    update.stamps = 0;

    if (apply) {
      batch.update(u.ref, update);
      pending += 1;
      if (pending >= 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
  }

  if (apply && pending > 0) await batch.commit();

  console.log(
    `${store.id} — 고객 ${users.size}명 / 이동 ${moved}명 (합계 ${sum.toLocaleString()}) / 잔여 stamps 정리 ${cleaned}명 / 손댈 것 없음 ${skipped}명`
  );

  totalMoved += moved;
  totalSkipped += skipped;
}

console.log(
  `\n${apply ? "✅ 반영 완료" : "🔍 미리보기 (--apply 없이 실행됨, 쓰기 없음)"} — 이동 ${totalMoved}명, 건너뜀 ${totalSkipped}명`
);
process.exit(0);
