/**
 * blankUser 덮어쓰기로 날아간 KB000001 고객의 쿠폰·레벨을 되돌린다.
 *
 * ── 배경 ────────────────────────────────────────────────────────────────
 * useGivePoint의 적립/사용 핸들러는 로컬 `user` 상태를 기준으로 새 값을 계산해
 * 문서를 통째로 덮어쓴다. `user`의 초기값은 blankUser(level 0, coupons {})이고,
 * 문서를 읽어오는 _resolveUserDoc은 레거시 고객의 경우 getDoc 왕복이 2회다.
 * 그 사이에 점주가 적립을 누르면 blankUser가 그대로 저장돼 쿠폰과 레벨이 0이 된다.
 * 레거시 문서가 남아 있는 KB000001에서만 발생했다. (코드는 guardLoaded로 수정됨)
 *
 * ── 재구성 방법 ─────────────────────────────────────────────────────────
 * `.backup-coupons-2026-08-08T1820.json`이 8/8 시점의 정확한 전체 스냅샷이다.
 * 여기서 출발해 logs 컬렉션을 시간순으로 재생한다:
 *   stamp_saved → stamps += stamp, 쿠폰은 coupons_issued만큼 phase 순서로 발급
 *   stamp_used  → coupons_redeemed만큼 차감
 * **유실 쓰기(레벨이 떨어진 그 로그)는 재생하지 않는다** — 스탬프 수는 정상이므로
 * 스탬프만 반영하고 레벨/쿠폰 리셋은 무시한다.
 *
 * 백업 시점(2026-08-08T09:20Z) **이후**에 유실된 고객만 대상이다. 그 전에 날아간
 * 고객은 백업에도 이미 빈 상태라 이 방법으로 복원할 수 없다 — 목록만 출력한다.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────
 *   node scripts/restore-wiped-progress.mjs                    # dry-run 전체
 *   node scripts/restore-wiped-progress.mjs --phone 010...     # 한 명만
 *   node scripts/restore-wiped-progress.mjs --apply            # 실제 반영
 *
 * 반영 전 대상 문서를 `.backup-restore-*.json`으로 저장한다.
 */

import { createRequire } from "module";
import { writeFileSync, readFileSync } from "fs";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

const STORE_CODE = "KB000001";
const BACKUP_FILE = ".backup-coupons-2026-08-08T1820.json";
/** 백업이 찍힌 시각. 이 이후 로그만 재생한다. */
const BACKUP_AT = Date.parse("2026-08-08T09:20:00Z") / 1000;

const APPLY = process.argv.includes("--apply");
const phoneArg = process.argv.indexOf("--phone");
const ONLY_PHONE = phoneArg !== -1 ? process.argv[phoneArg + 1] : null;

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const tsOf = (x) => x?._seconds ?? x?.seconds ?? 0;

/**
 * 이 사용 로그가 어느 쿠폰을 몇 장 썼는지 → {typeId: 장수}
 *
 * `coupons_redeemed`(총 장수)는 2026-08-24경부터만 있다. 그 이전 로그는 note가
 * 유일한 근거다: `"아메리카노 쿠폰 2장 제조음료 쿠폰 1장"` — 쿠폰 이름 뒤에
 * 장수가 붙는 형식이라 이름으로 typeId를 되짚을 수 있다.
 * note가 종류별로 나눠주므로 총계뿐인 coupons_redeemed보다 정확하다.
 */
function redeemedFrom(log, couponTypes) {
  const out = {};
  const note = typeof log.note === "string" ? log.note : "";
  // 이름이 긴 것부터 매칭한다 — 짧은 이름이 긴 이름의 접두사일 수 있다
  const types = [...couponTypes].sort((a, b) => b.name.length - a.name.length);
  for (const ct of types) {
    const m = note.match(new RegExp(`${ct.name}\\s*(\\d+)장`));
    if (m) out[ct.id] = (out[ct.id] ?? 0) + Number(m[1]);
  }
  const parsed = Object.values(out).reduce((s, v) => s + v, 0);
  if (parsed > 0) return out;

  // note를 못 읽으면 총계로 폴백. 종류를 모르니 시퀀스 순서로 가진 것부터 뺀다.
  const total = log.coupons_redeemed ?? 0;
  return total > 0 ? { __total: total } : {};
}

async function main() {
  const storeSnap = await db.doc(`stores/${STORE_CODE}`).get();
  const config = storeSnap.data()?.config ?? {};
  const seq = config.couponSequence ?? [];
  const spc = config.stampsPerCoupon;
  const levelOn = config.levelIncrementOn;
  const couponTypes = config.couponTypes ?? [];
  if (!seq.length || !spc || !levelOn) {
    console.error("❌ 중단: 매장 설정을 읽지 못했습니다.");
    process.exit(1);
  }

  // 8/8 스냅샷
  const backup = JSON.parse(readFileSync(BACKUP_FILE, "utf8"));
  const snapshotOf = new Map(backup.map((b) => [b.id, b.data]));

  // 로그를 전화번호별로 시간순 정렬
  const logSnap = await db
    .collection("logs")
    .where("store_code", "==", STORE_CODE)
    .get();
  const byPhone = new Map();
  for (const d of logSnap.docs) {
    const x = d.data();
    if (!byPhone.has(x.phone_number)) byPhone.set(x.phone_number, []);
    byPhone.get(x.phone_number).push(x);
  }
  for (const rows of byPhone.values())
    rows.sort((a, b) => tsOf(a.timestamp) - tsOf(b.timestamp));

  // 레벨이 떨어진 지점 = 유실 시점
  const wiped = [];
  for (const [phone, rows] of byPhone) {
    const lv = rows.filter((r) => typeof r.user_level === "number");
    for (let i = 1; i < lv.length; i++) {
      if (lv[i].user_level < lv[i - 1].user_level) {
        wiped.push({ phone, at: tsOf(lv[i].timestamp), lost: lv[i - 1].user_level - lv[i].user_level });
        break; // 첫 유실만 — 그 이후는 리플레이가 알아서 처리한다
      }
    }
  }

  const targets = wiped.filter((w) => w.at > BACKUP_AT);
  const tooOld = wiped.filter((w) => w.at <= BACKUP_AT);

  console.log(`유실 고객 ${wiped.length}명 중 백업 이후 ${targets.length}명 복구 가능\n`);

  const plans = [];
  for (const t of targets) {
    if (ONLY_PHONE && t.phone !== ONLY_PHONE) continue;
    const base = snapshotOf.get(t.phone);
    if (!base) {
      console.log(`⚠️  ${t.phone}: 8/8 백업에 없음 — 건너뜀`);
      continue;
    }

    // 백업 상태에서 출발
    let coupons = { ...(base.coupons ?? {}) };
    // 레거시 키는 이미 8/8에 정리됐지만, 백업은 정리 **전** 스냅샷이라 남아 있다
    delete coupons.americano;
    delete coupons.beverage;
    let issuedAt = JSON.parse(JSON.stringify(base.couponIssuedAt ?? {}));
    let level = base.level ?? 0;
    let phase = base.phase ?? seq[0];
    let stamps = base.stamps ?? 0;

    for (const r of byPhone.get(t.phone)) {
      const ts = tsOf(r.timestamp);
      if (ts <= BACKUP_AT) continue;
      if (r.action === "stamp_saved") {
        stamps += r.stamp ?? 0;
        // 쿠폰 발급은 로그의 coupons_issued를 믿지 않고 스탬프로 직접 계산한다.
        // 유실 이후 로그는 0으로 찍혀 있기 때문이다.
        while (stamps >= spc) {
          stamps -= spc;
          if (seq.indexOf(phase) === -1) phase = seq[0];
          coupons[phase] = (coupons[phase] ?? 0) + 1;
          const at = new Date(ts * 1000).toISOString();
          issuedAt[phase] = [...(issuedAt[phase] ?? []), at];
          if (phase === levelOn) level += 1;
          phase = seq[(seq.indexOf(phase) + 1) % seq.length];
        }
      } else if (r.action === "stamp_used") {
        // `coupons_redeemed`는 2026-08-24경부터 기록됐다. 그 이전 로그는 note에만
        // 장수가 남아 있다("아메리카노 쿠폰 2장 제조음료 쿠폰 1장"). note를 안 읽으면
        // 차감을 놓쳐 **쿠폰을 실제보다 많이 돌려주게 된다** — 점주 손해다.
        const used = redeemedFrom(r, couponTypes);
        for (const [key, n] of Object.entries(used)) {
          for (let i = 0; i < n; i++) {
            // __total = 종류 미상. 시퀀스 순서로 가진 것부터 뺀다.
            const typeId =
              key === "__total" ? seq.find((id) => (coupons[id] ?? 0) > 0) : key;
            if (!typeId || (coupons[typeId] ?? 0) <= 0) break;
            coupons[typeId] -= 1;
            // 어느 장을 골랐는지는 로그에 없다. 오래된 장부터 뺀다.
            if (Array.isArray(issuedAt[typeId]))
              issuedAt[typeId] = issuedAt[typeId].slice(1);
          }
        }
      }
    }

    const ref = db.doc(`users/${t.phone}`);
    const cur = (await ref.get()).data() ?? {};
    plans.push({ phone: t.phone, ref, cur, next: { coupons, couponIssuedAt: issuedAt, level, phase, stamps }, lost: t.lost });
  }

  for (const p of plans) {
    console.log(`── ${p.phone}`);
    console.log(`   현재: lvl=${p.cur.level} stamps=${p.cur.stamps} coupons=${JSON.stringify(p.cur.coupons)}`);
    console.log(`   복구: lvl=${p.next.level} stamps=${p.next.stamps} coupons=${JSON.stringify(p.next.coupons)} phase=${p.next.phase}`);
  }

  if (tooOld.length) {
    console.log(`\n백업 이전 유실 ${tooOld.length}명 (수동 확인 필요):`);
    for (const w of tooOld)
      console.log(`   ${w.phone} — ${new Date(w.at * 1000).toISOString().slice(0, 10)} 레벨 ${w.lost} 손실`);
  }

  if (!APPLY) {
    console.log(`\n(dry-run) 반영하려면 --apply`);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(
    `.backup-restore-${stamp}.json`,
    JSON.stringify(plans.map((p) => ({ id: p.phone, data: p.cur })), null, 2),
  );

  for (const p of plans) {
    await p.ref.update(p.next);
    console.log(`✅ ${p.phone} 복구`);
  }
  console.log(`\n${plans.length}명 반영 완료.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
