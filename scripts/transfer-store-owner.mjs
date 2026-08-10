/**
 * 매장의 소유 계정을 옮긴다. (주인 없는 레거시 매장의 최초 연결도 여기서 한다)
 *
 * ── 배경 ────────────────────────────────────────────────────────────────
 * 앱에는 더 이상 "전화번호로 기존 매장 불러오기"가 없다. 번호 소유를 검증하지
 * 않아서, 점주 연락처만 알면 남의 매장을 통째로 가져갈 수 있었기 때문이다
 * (매장을 쥐면 그 매장 고객 전화번호 전량까지 열린다). 보안 규칙도 "주인 없는
 * 매장은 누구나"를 허용하지 않도록 닫았다.
 *
 * 그래서 아래 두 경우는 이제 **서버에서만** 처리한다. 이 스크립트가 그 창구다.
 *   1) 주인 없는 레거시 매장을 점주 계정에 최초 연결       (예: U7KUF4 JS 볼링센터)
 *   2) 이미 연결된 매장을 다른 계정으로 이전               (예: KB000001 카페 그랑)
 *
 * ── 대상 계정 uid 얻는 법 ────────────────────────────────────────────────
 * 점주가 앱에서 구글/애플로 로그인하면 owners/{uid} 문서가 생기고, Functions의
 * onOwnerCreated가 **이메일·uid를 알림 메일로 보낸다.** 점주에게 uid를 물어볼
 * 필요 없이 그 메일을 보고 아래 --to 에 넣으면 된다.
 * (--to 대신 --to-email 로 이메일을 주면 owners에서 찾아준다)
 *
 * ── 하는 일 ─────────────────────────────────────────────────────────────
 *   - stores/{code}.ownerId          → 새 소유자 uid
 *   - owners/{새 소유자}.storeCodes   → 매장 코드 추가 (슬롯 한도도 함께 확보)
 *   - owners/{기존 소유자}.storeCodes → 매장 코드 제거
 *     레거시 provider-id 문서가 남아 있으면(마이그레이션 잔재) 거기서도 뺀다.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────
 *   node scripts/transfer-store-owner.mjs --store U7KUF4 --to-email a@b.com
 *   node scripts/transfer-store-owner.mjs --store U7KUF4 --to <uid> --apply
 *
 * --apply 없이 돌리면 아무것도 쓰지 않고 계획만 출력한다(dry-run).
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── 인자 파싱 ────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};
const APPLY = argv.includes("--apply");
const storeCode = arg("store");
const toUid = arg("to");
const toEmail = arg("to-email");

if (!storeCode || (!toUid && !toEmail)) {
  console.error(
    "사용법: node scripts/transfer-store-owner.mjs --store <매장코드> " +
      "(--to <uid> | --to-email <이메일>) [--apply]",
  );
  process.exit(1);
}

const mask = (p) => (p ? `${p.slice(0, 3)}****${p.slice(-4)}` : "(없음)");

/** 이메일로 owners 문서를 찾는다. Firebase uid 문서를 우선한다. */
async function findOwnerByEmail(email) {
  const snap = await db.collection("owners").where("email", "==", email).get();
  if (snap.empty) return null;

  // 레거시 provider-id 문서(migratedTo가 있는 것)는 후보에서 제외한다.
  const live = snap.docs.filter((d) => !d.data().migratedTo);
  const picked = live.length > 0 ? live : snap.docs;

  if (picked.length > 1) {
    console.error(`⚠️  ${email} 로 계정이 ${picked.length}개 나왔다:`);
    picked.forEach((d) => console.error(`      ${d.id}`));
    console.error("    --to <uid> 로 직접 지정할 것.");
    process.exit(1);
  }
  return picked[0];
}

// ─── 현재 상태 확인 ───────────────────────────────────────────────────────

const storeRef = db.doc(`stores/${storeCode}`);
const storeSnap = await storeRef.get();
if (!storeSnap.exists) {
  console.error(`❌ 매장 ${storeCode} 이(가) 없다.`);
  process.exit(1);
}
const store = storeSnap.data();

let newOwnerDoc;
if (toUid) {
  newOwnerDoc = await db.doc(`owners/${toUid}`).get();
  if (!newOwnerDoc.exists) {
    console.error(
      `❌ owners/${toUid} 문서가 없다. 점주가 아직 앱에서 로그인하지 않았을 수 있다.`,
    );
    process.exit(1);
  }
} else {
  newOwnerDoc = await findOwnerByEmail(toEmail);
  if (!newOwnerDoc) {
    console.error(
      `❌ ${toEmail} 로 된 계정이 없다. 점주가 아직 로그인하지 않았을 수 있다.`,
    );
    process.exit(1);
  }
}

const newUid = newOwnerDoc.id;
const newOwner = newOwnerDoc.data();
const oldUid = store.ownerId || null;

if (newOwner.migratedTo) {
  console.error(
    `❌ owners/${newUid} 는 레거시 문서다(migratedTo=${newOwner.migratedTo}).\n` +
      "   새 Firebase uid 문서로 지정할 것.",
  );
  process.exit(1);
}
if (newOwner.accountStatus === "pending_deletion") {
  console.error(`❌ owners/${newUid} 는 탈퇴 대기 상태다.`);
  process.exit(1);
}
if (oldUid === newUid) {
  console.log(`이미 ${newUid} 소유다. 할 일 없음.`);
  process.exit(0);
}

// 기존 소유자 쪽에서 뺄 문서들 — Firebase uid 문서와 레거시 provider-id 문서 모두.
const staleOwnerDocs = [];
if (oldUid) {
  const oldSnap = await db.doc(`owners/${oldUid}`).get();
  if (oldSnap.exists) staleOwnerDocs.push(oldSnap);
  const legacyUid = oldSnap.exists ? oldSnap.data().legacyUid : null;
  if (legacyUid) {
    const legacySnap = await db.doc(`owners/${legacyUid}`).get();
    if (legacySnap.exists) staleOwnerDocs.push(legacySnap);
  }
}

const newCodes = Array.from(
  new Set([...(newOwner.storeCodes || []), storeCode]),
);
const newLimit = Math.max(newOwner.slotLimit || 3, newCodes.length);

// ─── 계획 출력 ────────────────────────────────────────────────────────────

console.log(`\n매장  ${storeCode}  "${store.name}"`);
console.log(`  ownerPhone : ${mask(store.ownerPhone)}`);
console.log(`  ownerId    : ${oldUid || "(없음 — 주인 없는 레거시 매장)"}`);
console.log(`\n새 소유자  ${newUid}`);
console.log(`  email      : ${newOwner.email}`);
console.log(
  `  storeCodes : ${JSON.stringify(newOwner.storeCodes || [])} → ${JSON.stringify(newCodes)}`,
);
console.log(`  slotLimit  : ${newOwner.slotLimit || 3} → ${newLimit}`);

if (staleOwnerDocs.length > 0) {
  console.log("\n기존 소유자에서 제거:");
  staleOwnerDocs.forEach((d) => {
    const codes = d.data().storeCodes || [];
    console.log(
      `  owners/${d.id} (${d.data().email})` +
        `\n    ${JSON.stringify(codes)} → ${JSON.stringify(codes.filter((c) => c !== storeCode))}`,
    );
  });
}

if (!APPLY) {
  console.log("\n(dry-run — 아무것도 쓰지 않았다. 적용하려면 --apply)");
  process.exit(0);
}

// ─── 적용 ────────────────────────────────────────────────────────────────

const batch = db.batch();
batch.update(storeRef, { ownerId: newUid });
batch.update(newOwnerDoc.ref, { storeCodes: newCodes, slotLimit: newLimit });
staleOwnerDocs.forEach((d) => {
  batch.update(d.ref, {
    storeCodes: (d.data().storeCodes || []).filter((c) => c !== storeCode),
  });
});
await batch.commit();

console.log(`\n✅ ${storeCode} → ${newUid} (${newOwner.email}) 이전 완료`);
process.exit(0);
