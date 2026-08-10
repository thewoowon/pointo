/**
 * 활성 매장이 새 보안 규칙을 통과할 소유권을 갖췄는지 대조한다. (읽기 전용)
 *
 * 새 규칙에서 users/logs 목록 조회는 **owners/{uid}.storeCodes에 그 매장이 있을 때만**
 * 통과한다. stores.ownerId만 있고 owners 쪽 역참조가 없으면 점주는 적립내역·고객·
 * 통계를 전혀 못 본다. 그래서 양쪽을 모두 본다.
 *
 * ⚠️ 규칙 배포(firebase deploy --only firestore:rules) **직전에 반드시 한 번 더**
 *    돌릴 것. 구버전 앱은 아직 주인 없는 매장을 만들 수 있어서, 어제 통과했다고
 *    오늘도 통과한다는 보장이 없다.
 *
 *   node scripts/audit-store-owners.mjs
 *
 * ⛔로 뜬 매장은 scripts/transfer-store-owner.mjs 로 연결한다.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const stores = await db.collection("stores").get();
const owners = await db.collection("owners").get();

/**
 * 규칙의 ownsStore는 **owners/{request.auth.uid}** 한 곳만 본다.
 * 레거시 제공자 id로 키잉된 owners 문서는 아무리 storeCodes를 갖고 있어도
 * 규칙을 통과시키지 못한다. 그래서 "그 문서 id가 진짜 Firebase uid인가"를
 * Auth에 직접 물어 확인한다. (문자열 모양으로 추측하지 않는다)
 */
const auth = admin.auth();
const isRealUid = new Map();
await Promise.all(
  owners.docs.map(async (o) => {
    try {
      await auth.getUser(o.id);
      isRealUid.set(o.id, true);
    } catch {
      isRealUid.set(o.id, false);
    }
  }),
);

// owners.storeCodes 역색인 — Firebase uid 문서만 유효하다
const byCode = new Map();
owners.forEach((o) => {
  if (!isRealUid.get(o.id)) return;
  (o.data().storeCodes ?? []).forEach((c) => {
    if (!byCode.has(c)) byCode.set(c, []);
    byCode.get(c).push(o.id);
  });
});

const rows = [];
for (const s of stores.docs) {
  const code = s.id;
  const d = s.data();
  const [users, logs] = await Promise.all([
    db.collection("users").where("store_code", "==", code).count().get(),
    db.collection("logs").where("store_code", "==", code).count().get(),
  ]);
  rows.push({
    code,
    name: d.name ?? "(무명)",
    ownerId: d.ownerId ?? null,
    inOwnerDoc: byCode.get(code) ?? [],
    users: users.data().count,
    logs: logs.data().count,
    lastLogged: d.last_logged ?? "-",
  });
}

rows.sort((a, b) => b.logs - a.logs);

console.log("\n코드      로그   고객   ownerId  owners역참조  최근    이름");
console.log("─".repeat(78));
const broken = [];
for (const r of rows) {
  // 새 규칙에서 users/logs 조회가 통과하려면 owners/{uid}.storeCodes에 있어야 한다
  const ok = r.ownerId && r.inOwnerDoc.includes(r.ownerId);
  if (!ok && (r.logs > 0 || r.users > 0)) broken.push(r);
  console.log(
    `${r.code.padEnd(9)} ${String(r.logs).padStart(5)} ${String(r.users).padStart(6)}   ` +
      `${r.ownerId ? "있음" : "없음"}     ${r.inOwnerDoc.length ? "있음" : "없음"}      ` +
      `${r.lastLogged.padEnd(11)} ${ok ? "✅" : "⛔"} ${r.name}`,
  );
}

console.log("\n" + "═".repeat(78));
if (broken.length === 0) {
  console.log("✅ 활성 매장 전부 소유권 정상 — 규칙 배포 가능");
} else {
  console.log(`⛔ 규칙 배포 전 조치 필요: ${broken.length}곳\n`);
  for (const r of broken) {
    console.log(`  ${r.code} ${r.name} (고객 ${r.users} · 로그 ${r.logs}, 최근 ${r.lastLogged})`);
    const why = !r.ownerId
      ? "주인 없음 — 어떤 계정에도 연결 안 됨"
      : isRealUid.get(r.ownerId) === false
        ? `ownerId(${r.ownerId})가 레거시 제공자 id — 점주가 신버전에서 1회 로그인하면 자동 이전된다`
        : `owners/${r.ownerId}.storeCodes에 ${r.code}가 없음`;
    console.log(`     ${why}`);
    console.log(`     → node scripts/transfer-store-owner.mjs --store ${r.code} --to-email <점주이메일> --apply\n`);
  }
}
process.exit(0);
