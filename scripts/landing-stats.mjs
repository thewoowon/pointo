/**
 * 랜딩(hellopointo.com)에 박아둘 숫자를 실제 DB에서 뽑는다. (읽기 전용)
 *
 * ── 왜 있나 ─────────────────────────────────────────────────────────────
 * 랜딩의 "누적 가입 고객 N명"은 한 번 적어두면 아무도 다시 안 본다. 실제로
 * 1,170명이라고 적어둔 채 한참을 지냈는데 그 사이 1,500명을 넘겼다. 숫자가
 * 실제보다 작으면 파는 쪽이 손해고, 크면 거짓말이 된다. 그래서 손으로 세지
 * 않고 여기서 뽑는다.
 *
 * ── 언제 돌리나 ─────────────────────────────────────────────────────────
 * 랜딩 문구를 손볼 때, 그리고 새 매장을 붙인 다음. 분기에 한 번쯤이면 충분하다.
 *
 *   node scripts/landing-stats.mjs
 *
 * 출력 맨 아래에 pointo 웹 리포의 `content/stats.ts`에 그대로 붙여 넣을
 * 블록이 나온다. measuredAt도 같이 채워지니 언제 잰 숫자인지 남는다.
 *
 * ── 숫자를 고르는 기준 ──────────────────────────────────────────────────
 * 사람 수는 정확히, 이벤트 수는 내림해서 쓴다. "1,513명"은 구체적이라 믿음이
 * 가지만 "36,795건"은 지나치게 정확해서 오히려 조작처럼 보인다.
 *
 * 매장 수는 일부러 내보내지 않는다. stores에는 테스트로 만든 빈 매장이 섞여
 * 있어서 그대로 쓰면 부풀려진다. 실사용 매장은 아래 목록을 눈으로 보고
 * 판단할 것.
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const countOf = async (collection) =>
  (await db.collection(collection).count().get()).data().count;

const countWhere = async (collection, field, value) =>
  (await db.collection(collection).where(field, "==", value).count().get())
    .data().count;

const customers = await countOf("users");
const events = await countOf("logs");

/*
 * 매장별 내역. 초기 로그에는 store_code가 없어서(그 필드가 생기기 전 데이터)
 * 매장별 합이 전체와 맞지 않는다. 정상이다 — 그 로그는 전부 1호점 것이다.
 */
const stores = await db.collection("stores").get();
const rows = [];
for (const store of stores.docs) {
  rows.push({
    code: store.id,
    name: store.data().name ?? "",
    customers: await countWhere("users", "store_code", store.id),
    events: await countWhere("logs", "store_code", store.id),
  });
}
rows.sort((a, b) => b.customers - a.customers);

console.log(`\n전체   고객 ${customers}명 · 적립/사용 ${events}건\n`);
console.log("매장별 (고객 0명은 테스트 매장으로 보면 된다)");
for (const r of rows) {
  console.log(
    `  ${r.code.padEnd(9)} ${r.name.padEnd(16)}` +
      ` 고객 ${String(r.customers).padStart(5)}` +
      `  적립/사용 ${String(r.events).padStart(6)}`,
  );
}

// 이벤트 수는 1,000단위로 내림한다. 위 주석 참고.
const roundedEvents = Math.floor(events / 1000) * 1000;
const today = new Date().toISOString().slice(0, 10);

console.log(`
─────────────────────────────────────────────────────────
pointo 웹 리포의 content/stats.ts 에 붙여 넣을 것:

export const stats = {
  measuredAt: "${today}",
  customers: ${customers},
  events: ${roundedEvents},
};
─────────────────────────────────────────────────────────
`);

process.exit(0);
