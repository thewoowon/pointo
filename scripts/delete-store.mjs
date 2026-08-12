/**
 * 매장 하나를 관련 데이터까지 통째로 지운다. **되돌릴 수 없다.**
 *
 * ── 언제 쓰나 ───────────────────────────────────────────────────────────
 * 테스트/심사용으로 만들었다가 더 쓰지 않는 매장을 치울 때만. 실사용 매장은
 * 절대 대상이 아니다. 고객 전화번호와 적립 이력이 함께 사라진다.
 *
 * ── 안전장치 ────────────────────────────────────────────────────────────
 *   1. `--apply` 없이 돌리면 계획만 출력한다(dry-run).
 *   2. `--apply` 시 **지우기 전에 전량을 .backup-store-{코드}-{시각}.json 으로
 *      떨군다.** 이 파일에는 고객 전화번호가 들어 있다 — .gitignore의
 *      `.backup-*.json`이 커밋을 막지만, 다 쓰고 나면 지울 것.
 *   3. 실사용 흔적(로그 N건 이상)이 있으면 `--force` 없이는 거부한다.
 *
 * ── 지우는 것 ───────────────────────────────────────────────────────────
 *   stores/{코드} · users(store_code=코드) · logs(store_code=코드)
 *   terms(해당 고객) · sessions/session_{코드}
 *   owners/*.storeCodes 에서도 코드를 뺀다.
 *
 * users를 지우면 onUserDeleted가 그 고객의 로그를 정리하지만, 여기서도 직접
 * 지운다 — 트리거는 비동기라 완료를 기다릴 수 없고, store_code가 없는 고아
 * 문서에는 아예 동작하지 않기 때문이다.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────
 *   node scripts/delete-store.mjs --store 6CJOTR
 *   node scripts/delete-store.mjs --store 6CJOTR --apply
 */

import { createRequire } from "module";
import { writeFileSync } from "fs";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};
const APPLY = argv.includes("--apply");
const FORCE = argv.includes("--force");
const storeCode = arg("store");

if (!storeCode) {
  console.error(
    "사용법: node scripts/delete-store.mjs --store <매장코드> [--apply] [--force]",
  );
  process.exit(1);
}

/** 실사용으로 볼 로그 수. 이 이상이면 --force를 요구한다. */
const ACTIVITY_THRESHOLD = 50;

const mask = (p) => (p ? `${p.slice(0, 3)}****${p.slice(-4)}` : "(없음)");

// ─── 수집 ────────────────────────────────────────────────────────────────

const storeRef = db.doc(`stores/${storeCode}`);
const storeSnap = await storeRef.get();
if (!storeSnap.exists) {
  console.error(`❌ 매장 ${storeCode} 이(가) 없다.`);
  process.exit(1);
}

const users = await db.collection("users").where("store_code", "==", storeCode).get();
const logs = await db.collection("logs").where("store_code", "==", storeCode).get();
const sessionSnap = await db.doc(`sessions/session_${storeCode}`).get();

// terms는 users와 같은 문서 ID를 쓴다.
const termSnaps = [];
for (const u of users.docs) {
  const t = await db.doc(`terms/${u.id}`).get();
  if (t.exists) termSnaps.push(t);
}

// storeCodes에 이 매장을 들고 있는 계정
const owners = await db.collection("owners").get();
const holders = owners.docs.filter((o) =>
  (o.data().storeCodes ?? []).includes(storeCode),
);

// ─── 계획 ────────────────────────────────────────────────────────────────

const store = storeSnap.data();
console.log(`\n삭제 대상  ${storeCode}  "${store.name}"`);
console.log(`  createdAt  ${store.createdAt ?? "(없음)"}`);
console.log(`  ownerPhone ${mask(store.ownerPhone)}`);
console.log(`  ownerId    ${store.ownerId ?? "(없음)"}`);
console.log(`\n함께 지워지는 것`);
console.log(`  users      ${users.size}건  (고객 전화번호)`);
console.log(`  logs       ${logs.size}건`);
console.log(`  terms      ${termSnaps.length}건`);
console.log(`  sessions   ${sessionSnap.exists ? 1 : 0}건`);
if (holders.length > 0) {
  console.log(`\n계정에서 매장 코드 제거`);
  holders.forEach((o) =>
    console.log(`  owners/${o.id} (${o.data().email})`),
  );
}

if (logs.size >= ACTIVITY_THRESHOLD && !FORCE) {
  console.error(
    `\n⛔ 로그가 ${logs.size}건이다. 실사용 매장일 수 있어 거부한다.` +
      `\n   정말 지우려면 --force 를 붙일 것.`,
  );
  process.exit(1);
}

if (!APPLY) {
  console.log("\n(dry-run — 아무것도 지우지 않았다. 적용하려면 --apply)");
  process.exit(0);
}

// ─── 백업 ────────────────────────────────────────────────────────────────

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `.backup-store-${storeCode}-${stamp}.json`;
const dump = (snaps) => snaps.map((d) => ({ id: d.id, data: d.data() }));

writeFileSync(
  backupPath,
  JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      store: { id: storeSnap.id, data: store },
      users: dump(users.docs),
      logs: dump(logs.docs),
      terms: dump(termSnaps),
      session: sessionSnap.exists
        ? { id: sessionSnap.id, data: sessionSnap.data() }
        : null,
      ownerRefs: holders.map((o) => ({ id: o.id, email: o.data().email })),
    },
    null,
    2,
  ),
);
console.log(`\n💾 백업 저장: ${backupPath}`);
console.log("   (고객 전화번호가 들어 있다. 다 쓰면 지울 것)");

// ─── 삭제 ────────────────────────────────────────────────────────────────

/** Firestore 배치 상한이 500이라 나눠 커밋한다. */
async function deleteAll(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

// 로그를 먼저 지운다. users를 먼저 지우면 onUserDeleted가 같은 로그를 지우려
// 달려들어 경합한다(결과는 같지만 로그가 지저분해진다).
await deleteAll(logs.docs.map((d) => d.ref));
console.log(`🗑  logs ${logs.size}건 삭제`);

await deleteAll(termSnaps.map((d) => d.ref));
console.log(`🗑  terms ${termSnaps.length}건 삭제`);

await deleteAll(users.docs.map((d) => d.ref));
console.log(`🗑  users ${users.size}건 삭제`);

if (sessionSnap.exists) {
  await sessionSnap.ref.delete();
  console.log("🗑  session 삭제");
}

for (const o of holders) {
  await o.ref.update({
    storeCodes: (o.data().storeCodes ?? []).filter((c) => c !== storeCode),
  });
  console.log(`✂️  owners/${o.id} 에서 ${storeCode} 제거`);
}

await storeRef.delete();
console.log(`🗑  stores/${storeCode} 삭제`);

console.log(`\n✅ ${storeCode} "${store.name}" 삭제 완료`);
process.exit(0);
