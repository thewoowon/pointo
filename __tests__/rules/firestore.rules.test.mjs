/**
 * 포인토 Firestore 보안 규칙 검증.
 *
 * 규칙은 프로덕션 데이터 접근을 통째로 결정한다. 한 줄만 틀려도 (a) 앱 전체가
 * permission-denied로 멈추거나 (b) 고객 전화번호가 열린다. 손으로 확인하지 말고
 * 규칙을 고칠 때마다 이걸 돌릴 것.
 *
 * 실행:
 *   npm i -D @firebase/rules-unit-testing firebase   # 최초 1회
 *   JAVA_HOME=<JDK 21+ 경로> \
 *     firebase emulators:exec --only firestore --project demo-pointo \
 *     "node __tests__/rules/firestore.rules.test.mjs"
 *
 * (firebase-tools 15+는 JDK 21 이상을 요구한다)
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {readFileSync} from 'fs';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
} from 'firebase/firestore';

// 레포 루트에서 실행되는 것을 전제로 한다 (firebase emulators:exec의 기본 cwd)
const RULES = readFileSync('firestore.rules', 'utf8');

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-pointo',
  firestore: {rules: RULES, host: '127.0.0.1', port: 8080},
});

// ─── 시드 데이터 ────────────────────────────────────────────────────────
await testEnv.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'owners/uidA'), {
    email: 'a@x.com', storeCodes: ['STORE_A'], slotLimit: 3, createdAt: 'now',
  });
  await setDoc(doc(db, 'owners/uidB'), {
    email: 'b@x.com', storeCodes: ['STORE_B'], slotLimit: 3, createdAt: 'now',
  });
  // Firebase Auth 도입 전에 만들어진 레거시 계정 (구글 sub로 키잉)
  await setDoc(doc(db, 'owners/googleSubLegacy'), {
    email: 'l@x.com', storeCodes: ['STORE_L'], slotLimit: 3, createdAt: 'old',
  });

  await setDoc(doc(db, 'stores/STORE_A'), {name: 'A', ownerId: 'uidA'});
  await setDoc(doc(db, 'stores/STORE_B'), {name: 'B', ownerId: 'uidB'});
  await setDoc(doc(db, 'stores/STORE_L'), {name: 'L', ownerId: 'googleSubLegacy'});
  await setDoc(doc(db, 'stores/STORE_FREE'), {name: 'Free'});

  await setDoc(doc(db, 'users/01011112222_STORE_A'), {
    store_code: 'STORE_A', stamps: 3, level: 0, coupons: {},
  });
  await setDoc(doc(db, 'users/01033334444_STORE_B'), {
    store_code: 'STORE_B', stamps: 5, level: 1, coupons: {},
  });

  await setDoc(doc(db, 'logs/logA'), {
    store_code: 'STORE_A', phone_number: '01011112222', stamp: 1,
    action: 'stamp_saved', note: '', timestamp: new Date(),
  });
  await setDoc(doc(db, 'logs/logB'), {
    store_code: 'STORE_B', phone_number: '01033334444', stamp: 1,
    action: 'stamp_saved', note: '', timestamp: new Date(),
  });

  await setDoc(doc(db, 'ownerTokens/uidA'), {appleRefreshToken: 'SECRET'});
  await setDoc(doc(db, 'terms/01011112222_STORE_A'), {agreed: true, date: 'now'});
});

// ─── 컨텍스트 ──────────────────────────────────────────────────────────
const noAuth = testEnv.unauthenticatedContext().firestore();
const kiosk = testEnv
  .authenticatedContext('anon1', {firebase: {sign_in_provider: 'anonymous'}})
  .firestore();
const ownerA = testEnv
  .authenticatedContext('uidA', {
    firebase: {sign_in_provider: 'google.com', identities: {'google.com': ['googleSubA']}},
  })
  .firestore();
const ownerB = testEnv
  .authenticatedContext('uidB', {
    firebase: {sign_in_provider: 'google.com', identities: {'google.com': ['googleSubB']}},
  })
  .firestore();
// 레거시 계정 소유자가 Firebase Auth로 처음 로그인한 상태
const migrator = testEnv
  .authenticatedContext('uidNewL', {
    firebase: {
      sign_in_provider: 'google.com',
      identities: {'google.com': ['googleSubLegacy']},
    },
  })
  .firestore();

// ─── 러너 ──────────────────────────────────────────────────────────────
let pass = 0;
const failures = [];
async function check(name, shouldSucceed, fn) {
  try {
    await (shouldSucceed ? assertSucceeds(fn()) : assertFails(fn()));
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ❌ ${name}\n       ${String(e).split('\n')[0]}`);
  }
}
const ALLOW = true;
const DENY = false;

console.log('\n[1] 미인증 — 전부 차단되어야 한다');
await check('미인증: 고객 단건 조회', DENY, () =>
  getDoc(doc(noAuth, 'users/01011112222_STORE_A')));
await check('미인증: 고객 전체 덤프', DENY, () =>
  getDocs(collection(noAuth, 'users')));
await check('미인증: 로그 전체 덤프', DENY, () =>
  getDocs(collection(noAuth, 'logs')));
await check('미인증: 매장 조회', DENY, () => getDoc(doc(noAuth, 'stores/STORE_A')));
await check('미인증: 고객 생성', DENY, () =>
  setDoc(doc(noAuth, 'users/09900000000_STORE_A'), {store_code: 'STORE_A'}));

console.log('\n[2] 익명 키오스크 — 단건은 되고 열거는 막혀야 한다 ⭐');
await check('키오스크: 고객 단건 조회', ALLOW, () =>
  getDoc(doc(kiosk, 'users/01011112222_STORE_A')));
await check('키오스크: 고객 전체 덤프 (전화번호 유출)', DENY, () =>
  getDocs(collection(kiosk, 'users')));
await check('키오스크: 매장 지정 고객 목록 (우회 시도)', DENY, () =>
  getDocs(query(collection(kiosk, 'users'), where('store_code', '==', 'STORE_A'))));
await check('키오스크: 로그 전체 덤프 (전화번호 유출)', DENY, () =>
  getDocs(collection(kiosk, 'logs')));
await check('키오스크: 매장 지정 로그 조회 (우회 시도)', DENY, () =>
  getDocs(query(collection(kiosk, 'logs'), where('store_code', '==', 'STORE_A'))));
await check('키오스크: 매장 설정 읽기', ALLOW, () =>
  getDoc(doc(kiosk, 'stores/STORE_A')));
await check('키오스크: 매장 목록 열거', DENY, () =>
  getDocs(collection(kiosk, 'stores')));
await check('키오스크: 신규 고객 가입', ALLOW, () =>
  setDoc(doc(kiosk, 'users/01055556666_STORE_A'), {
    store_code: 'STORE_A', stamps: 0, level: 0, coupons: {},
  }));
await check('키오스크: 적립 로그 기록', ALLOW, () =>
  addDoc(collection(kiosk, 'logs'), {
    store_code: 'STORE_A', phone_number: '01011112222', stamp: 1,
    action: 'stamp_saved', note: '', timestamp: new Date(),
  }));
await check('키오스크: 고객 탈퇴(본인 문서 삭제)', ALLOW, () =>
  deleteDoc(doc(kiosk, 'users/01055556666_STORE_A')));
await check('키오스크: 점주 계정 훔쳐보기', DENY, () =>
  getDoc(doc(kiosk, 'owners/uidA')));
await check('키오스크: 세션 페어링 읽기', ALLOW, () =>
  getDoc(doc(kiosk, 'sessions/session_STORE_A')));

console.log('\n[2-b] 실제 적립 경로 — 절대 막히면 안 된다');
await check('키오스크: 스탬프 적립(고객 업데이트)', ALLOW, () =>
  updateDoc(doc(kiosk, 'users/01011112222_STORE_A'), {
    stamps: 4, last_used: '2026-08-08',
  }));
await check('점주: 스탬프 적립(고객 업데이트)', ALLOW, () =>
  updateDoc(doc(ownerA, 'users/01011112222_STORE_A'), {stamps: 5, level: 1}));
await check('키오스크: 고객을 남의 매장으로 옮기기', DENY, () =>
  updateDoc(doc(kiosk, 'users/01011112222_STORE_A'), {store_code: 'STORE_B'}));
await check('키오스크: 약관 동의 기록', ALLOW, () =>
  setDoc(doc(kiosk, 'terms/01055556666_STORE_A'), {agreed: true, date: 'now'}));
await check('키오스크: 약관 컬렉션 열거', DENY, () =>
  getDocs(collection(kiosk, 'terms')));
await check('키오스크: 세션 모드 전환', ALLOW, () =>
  setDoc(doc(kiosk, 'sessions/session_STORE_A'), {
    is_confirmed: false, last_used: '2026-08-08', phone: '', mode: 'waiting',
  }));
await check('키오스크: 세션 목록 열거(매장 코드 수집)', DENY, () =>
  getDocs(collection(kiosk, 'sessions')));
await check('점주: 신규 매장 등록', ALLOW, () =>
  setDoc(doc(ownerA, 'stores/STORE_NEW'), {name: '새매장', ownerPhone: '01000000000'}));
await check('점주: 매장 등록 시 세션 생성', ALLOW, () =>
  setDoc(doc(ownerA, 'sessions/session_STORE_NEW'), {
    is_confirmed: false, last_used: '2026-08-08', phone: '', mode: 'waiting',
  }));
await check('점주: 전화번호로 내 매장 찾기', ALLOW, () =>
  getDocs(query(collection(ownerA, 'stores'), where('ownerPhone', '==', '01000000000'))));

console.log('\n[3] 점주 — 자기 매장만 ⭐');
await check('점주A: 자기 매장 고객 목록', ALLOW, () =>
  getDocs(query(collection(ownerA, 'users'), where('store_code', '==', 'STORE_A'))));
await check('점주A: 남의 매장 고객 목록', DENY, () =>
  getDocs(query(collection(ownerA, 'users'), where('store_code', '==', 'STORE_B'))));
await check('점주A: 필터 없이 전체 고객 덤프', DENY, () =>
  getDocs(collection(ownerA, 'users')));
await check('점주A: 자기 매장 로그 목록', ALLOW, () =>
  getDocs(query(collection(ownerA, 'logs'), where('store_code', '==', 'STORE_A'))));
await check('점주A: 남의 매장 로그 목록', DENY, () =>
  getDocs(query(collection(ownerA, 'logs'), where('store_code', '==', 'STORE_B'))));
await check('점주A: 자기 매장 로그 삭제', ALLOW, () =>
  deleteDoc(doc(ownerA, 'logs/logA')));
await check('점주B: 남의 매장 로그 삭제', DENY, () =>
  deleteDoc(doc(ownerB, 'logs/logA')));
await check('점주A: 로그 위변조', DENY, () =>
  updateDoc(doc(ownerA, 'logs/logB'), {stamp: 999}));

console.log('\n[4] 계정·매장 소유권 ⭐');
await check('점주A: 자기 계정 읽기', ALLOW, () => getDoc(doc(ownerA, 'owners/uidA')));
await check('점주A: 남의 계정 읽기', DENY, () => getDoc(doc(ownerA, 'owners/uidB')));
await check('점주A: 남의 계정에 매장 밀어넣기', DENY, () =>
  updateDoc(doc(ownerA, 'owners/uidB'), {storeCodes: ['STORE_A', 'STORE_B']}));
await check('점주A: 계정 목록 열거', DENY, () => getDocs(collection(ownerA, 'owners')));
await check('점주A: 자기 매장 설정 변경', ALLOW, () =>
  updateDoc(doc(ownerA, 'stores/STORE_A'), {name: 'A2'}));
await check('점주A: 남의 매장 탈취', DENY, () =>
  updateDoc(doc(ownerA, 'stores/STORE_B'), {ownerId: 'uidA'}));
await check('점주A: 주인 없는 매장 claim', ALLOW, () =>
  updateDoc(doc(ownerA, 'stores/STORE_FREE'), {ownerId: 'uidA'}));

console.log('\n[5] 레거시 uid 마이그레이션 ⭐');
await check('본인: 레거시 계정 읽기', ALLOW, () =>
  getDoc(doc(migrator, 'owners/googleSubLegacy')));
await check('본인: 레거시 계정에 이전 표식', ALLOW, () =>
  updateDoc(doc(migrator, 'owners/googleSubLegacy'), {migratedTo: 'uidNewL'}));
await check('본인: 레거시 매장 소유권 이전', ALLOW, () =>
  updateDoc(doc(migrator, 'stores/STORE_L'), {ownerId: 'uidNewL'}));
await check('타인: 남의 레거시 계정 읽기', DENY, () =>
  getDoc(doc(ownerA, 'owners/googleSubLegacy')));
await check('타인: 남의 레거시 매장 탈취', DENY, () =>
  updateDoc(doc(ownerB, 'stores/STORE_L'), {ownerId: 'uidB'}));

console.log('\n[6] 서버 전용 컬렉션 ⭐');
await check('점주A: 자기 Apple 토큰 읽기', DENY, () =>
  getDoc(doc(ownerA, 'ownerTokens/uidA')));
await check('키오스크: Apple 토큰 읽기', DENY, () =>
  getDoc(doc(kiosk, 'ownerTokens/uidA')));
await check('미인증: Apple 토큰 읽기', DENY, () =>
  getDoc(doc(noAuth, 'ownerTokens/uidA')));
await check('정의되지 않은 컬렉션 접근', DENY, () =>
  getDoc(doc(ownerA, 'secretStuff/x')));

console.log(`\n${'─'.repeat(50)}`);
console.log(`통과 ${pass} / 실패 ${failures.length}`);
if (failures.length) {
  console.log('실패 목록:');
  failures.forEach(f => console.log(`  - ${f}`));
}
await testEnv.cleanup();
process.exit(failures.length ? 1 : 0);
