/**
 * 카페 그랑 레거시 데이터 마이그레이션
 *
 * 수행 내용:
 * 1. stores/KB000001 config에 couponTypes 2종(coupon_a, coupon_b) 세팅
 * 2. users 전체 순회:
 *    - americanoCoupons → coupons.coupon_a
 *    - beverageCoupons  → coupons.coupon_b
 *    - phase: 'americano' → 'coupon_a', 'beverage' → 'coupon_b'
 *
 * 사용법:
 *   node scripts/migrate-coupons.js
 *
 * 필요:
 *   프로젝트 루트에 serviceAccountKey.json (Firebase Console → 서비스 계정 → 새 비공개 키 생성)
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.resolve(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const STORE_CODE = 'KB000001';
const PHASE_MAP = {americano: 'coupon_a', beverage: 'coupon_b'};

const COUPON_TYPES = [
  {id: 'coupon_a', name: '아메리카노 쿠폰', description: '무료 쿠폰이 한장 생겨요!'},
  {id: 'coupon_b', name: '음료 쿠폰', description: '무료 쿠폰이 한장 생겨요!'},
];

async function migrateStoreConfig() {
  console.log('\n=== Store Config 마이그레이션 ===');
  const storeRef = db.collection('stores').doc(STORE_CODE);
  const snap = await storeRef.get();

  if (!snap.exists) {
    console.log(`  ⚠ stores/${STORE_CODE} 문서 없음. 스킵.`);
    return;
  }

  const data = snap.data();
  const config = data.config || {};

  const updatedConfig = {
    ...config,
    couponTypes: COUPON_TYPES,
    couponSequence: ['coupon_a', 'coupon_b'],
    levelIncrementOn: 'coupon_a',
  };

  await storeRef.update({config: updatedConfig});
  console.log(`  ✓ stores/${STORE_CODE} config 업데이트 완료`);
  console.log(`    couponTypes: ${JSON.stringify(COUPON_TYPES.map(c => c.id))}`);
}

async function migrateUsers() {
  console.log('\n=== Users 마이그레이션 ===');
  const usersSnap = await db.collection('users').get();
  console.log(`  총 ${usersSnap.size}명`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const update = {};

    // coupons 객체 추가 (레거시 flat 필드는 그대로 유지)
    const americano = data.americanoCoupons ?? data.coupons?.americano ?? 0;
    const beverage = data.beverageCoupons ?? data.coupons?.beverage ?? 0;

    update.coupons = {
      coupon_a: americano,
      coupon_b: beverage,
    };

    // phase는 건드리지 않음 — 다음 적립 시 handleApprove에서 자동 보정됨

    try {
      await doc.ref.update(update);
      migrated++;
      if (migrated % 100 === 0) {
        console.log(`  ... ${migrated}명 처리됨`);
      }
    } catch (err) {
      console.error(`  ✗ ${doc.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n  ✓ 마이그레이션 완료: ${migrated}명 성공, ${skipped}명 스킵, ${errors}명 에러`);
}

async function dryRun() {
  console.log('\n=== DRY RUN (미리보기) ===');
  const usersSnap = await db.collection('users').where('store_code', '==', STORE_CODE).limit(5).get();

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const americano = data.americanoCoupons ?? data.coupons?.americano ?? 0;
    const beverage = data.beverageCoupons ?? data.coupons?.beverage ?? 0;
    const newPhase = PHASE_MAP[data.phase] ?? data.phase;

    console.log(`  ${doc.id}:`);
    console.log(`    before: americanoCoupons=${data.americanoCoupons}, beverageCoupons=${data.beverageCoupons}, phase=${data.phase}`);
    console.log(`    after:  coupons={coupon_a: ${americano}, coupon_b: ${beverage}}, phase=${newPhase}`);
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('🔄 카페 그랑 쿠폰 데이터 마이그레이션');
  console.log(`   프로젝트: ${serviceAccount.project_id}`);
  console.log(`   매장: ${STORE_CODE}`);
  console.log(`   모드: ${isDryRun ? 'DRY RUN (변경 없음)' : '실행'}`);

  if (isDryRun) {
    await dryRun();
  } else {
    await migrateStoreConfig();
    await migrateUsers();
  }

  console.log('\n✅ 완료');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ 마이그레이션 실패:', err);
  process.exit(1);
});
