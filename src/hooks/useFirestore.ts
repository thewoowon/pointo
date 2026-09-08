import {
  doc,
  getFirestore,
  getDoc,
  setDoc,
  collection,
  updateDoc,
  where,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  deleteDoc,
} from '@react-native-firebase/firestore';
import dayjs from 'dayjs';

/** 스토어별 고객 문서 ID 생성 (멀티스토어 분리용) */
export function getUserDocId(
  phoneNumber: string,
  storeCode?: string | null,
): string {
  return storeCode ? `${phoneNumber}_${storeCode}` : phoneNumber;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * 복합 문서 ID(`{phone}_{storeCode}`)에서 전화번호만 뽑는다.
 * 레거시 문서(전화번호 단독 ID)는 그대로 통과한다.
 */
export function stripStoreSuffix(docId: string): string {
  const idx = docId.indexOf('_');
  return idx === -1 ? docId : docId.slice(0, idx);
}

/**
 * 같은 전화번호의 문서가 둘일 수 있어 하나로 접는다.
 *
 *   레거시: `01012345678`         (매장 분리 이전에 만들어진 문서)
 *   복합:   `01012345678_ABC123`
 *
 * 접지 않으면 고객 목록에 같은 사람이 두 번 나오고, 통계의 회원 수·KPI가
 * 그만큼 부풀려진다. (카페 그랑에서 실제로 10건 확인됐다)
 *
 * 복합 문서를 우선한다 — _resolveUserDoc이 복합을 먼저 찾으므로 키오스크가
 * 실제로 읽고 쓰는 쪽이 복합이다. 레거시를 보여주면 고객 화면과 어긋난다.
 */
function dedupeByPhone(
  docs: Array<{id: string; data: () => any}>,
): Array<User & {phone: string}> {
  const byPhone = new Map<string, User & {phone: string}>();
  for (const d of docs) {
    const phone = stripStoreSuffix(d.id);
    const isComposite = d.id.includes('_');
    if (!byPhone.has(phone) || isComposite) {
      byPhone.set(phone, {phone, ...(d.data() as User)});
    }
  }
  return Array.from(byPhone.values());
}

function generateStoreCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** 이메일 계정당 기본 스토어 슬롯 수. 구독 시 확장(Phase 2). */
export const DEFAULT_SLOT_LIMIT = 3;
export const SUBSCRIBED_SLOT_LIMIT = 10;

const useFirestore = (storeCode?: string | null) => {
  const storeFilter = storeCode
    ? [where('store_code', '==', storeCode)]
    : [];

  const _docId = (phoneNumber: string) =>
    getUserDocId(phoneNumber, storeCode);

  /** 복합 ID 우선 조회, 없으면 레거시(전화번호만) 폴백 */
  async function _resolveUserDoc(phoneNumber: string) {
    const db = getFirestore();
    const compositeId = _docId(phoneNumber);
    const compositeSnap = await getDoc(doc(db, 'users', compositeId));
    if (compositeSnap.exists) {
      return {id: compositeId, snap: compositeSnap};
    }
    // 레거시 폴백: 복합 ID 이전에 생성된 유저 (store_code 정확히 일치만 허용)
    if (storeCode) {
      const legacySnap = await getDoc(doc(db, 'users', phoneNumber));
      if (legacySnap.exists) {
        const data = legacySnap.data();
        if (data?.store_code === storeCode) {
          return {id: phoneNumber, snap: legacySnap};
        }
      }
    }
    return null;
  }

  /** 스크린에서 onSnapshot용 docId 해석 */
  async function resolveUserDocId(phoneNumber: string): Promise<string> {
    const resolved = await _resolveUserDoc(phoneNumber);
    return resolved ? resolved.id : _docId(phoneNumber);
  }

  async function addUser(userId: string) {
    try {
      const db = getFirestore();
      const docId = _docId(userId);

      const usersRef = collection(db, 'users');
      const termsRef = collection(db, 'terms');

      const date = new Date().toISOString();

      await setDoc(doc(usersRef, docId), {
        last_used: date.split('T')[0],
        created_at: date.split('T')[0],
        level: 0,
        stamps: 0,
        points: 0,
        phase: 'americano',
        coupons: {},
        hasRated: false,
        ...(storeCode ? {store_code: storeCode} : {}),
      });

      await setDoc(doc(termsRef, docId), {
        agreed: true,
        date,
      });

      console.log('✅ User added successfully!');

      return true;
    } catch (error) {
      console.error('Error adding document:', error);
      return false;
    }
  }

  async function getUser(userId: string) {
    try {
      const resolved = await _resolveUserDoc(userId);
      if (!resolved) {
        console.log('No such document!');
        return undefined;
      }
      console.log('User Document data:', resolved.snap.data());
      return resolved.snap.data();
    } catch (error) {
      console.error('Error getting document:', error);
      return undefined;
    }
  }

  async function updateUser(userId: string, data: any) {
    try {
      const db = getFirestore();
      const resolved = await _resolveUserDoc(userId);
      const docId = resolved ? resolved.id : _docId(userId);
      const userRef = doc(db, 'users', docId);
      await updateDoc(userRef, data);
      console.log('User updated successfully!');
    } catch (error) {
      console.error('Error updating document:', error);
    }
  }

  /**
   * 새 매장 등록. ownerId는 **생성 시점에** 박는다.
   *
   * 예전에는 매장을 먼저 만들고 linkStoreToOwner가 나중에 주인을 채웠다. 그러려면
   * 보안 규칙이 "주인 없는 매장은 아무나 가져갈 수 있다"를 허용해야 했고, 그게
   * 전화번호만 알면 남의 매장을 탈취할 수 있는 경로였다. 주인 없는 매장이라는
   * 상태를 아예 만들지 않는다.
   */
  async function registerStore(data: {
    name: string;
    ownerPhone: string;
    ownerId: string;
  }): Promise<{storeCode: string} | null> {
    try {
      const db = getFirestore();
      const storesRef = collection(db, 'stores');

      let newStoreCode = generateStoreCode();
      let attempts = 0;
      while (attempts < 10) {
        const snap = await getDoc(doc(storesRef, newStoreCode));
        if (!snap.exists) break;
        newStoreCode = generateStoreCode();
        attempts++;
      }

      const now = new Date().toISOString();

      await setDoc(doc(storesRef, newStoreCode), {
        name: data.name,
        ownerPhone: normalizePhone(data.ownerPhone),
        ownerId: data.ownerId,
        createdAt: now,
        last_logged: now.split('T')[0],
        status: 'approved',
      });

      const sessionsRef = collection(db, 'sessions');
      await setDoc(doc(sessionsRef, `session_${newStoreCode}`), {
        is_confirmed: false,
        last_used: now.split('T')[0],
        phone: '',
        mode: 'waiting',
      });

      console.log('✅ Store registered:', newStoreCode);
      return {storeCode: newStoreCode};
    } catch (error) {
      console.error('Error registering store:', error);
      return null;
    }
  }

  async function getStores(code: string) {
    try {
      const db = getFirestore();
      const docRef = doc(db, 'stores', code);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists) {
        console.log('Store Document data:', docSnap.data());
      } else {
        console.log('No such document!');
      }

      return docSnap.data() as Store | undefined;
    } catch (error) {
      console.error('Error getting document:', error);
      return undefined;
    }
  }

  async function enterNumber(sessionId: string) {
    try {
      const db = getFirestore();
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, {mode: 'waiting'});
      console.log('고객 태블릿이 전화번호 입력 화면으로 전환됩니다!');
    } catch (error) {
      console.error('Error updating document:', error);
    }
  }

  async function updateSession(sessionId: string, data: any) {
    try {
      const db = getFirestore();
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, data);
      console.log('Session updated successfully!');
    } catch (error) {
      console.error('Error updating document:', error);
    }
  }

  async function getLogs(date: string): Promise<Log[]> {
    try {
      const db = getFirestore();
      const logsRef = collection(db, 'logs');

      const start = dayjs(date).startOf('day').toDate();
      const end = dayjs(date).endOf('day').toDate();

      const logsQuery = query(
        logsRef,
        ...storeFilter,
        where('timestamp', '>=', start),
        where('timestamp', '<=', end),
        orderBy('timestamp', 'desc'),
        limit(200),
      );

      const querySnapshot = await getDocs(logsQuery);

      console.log('Logs fetched successfully!');

      const logs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...(data as Log),
          timestamp: data.timestamp.toDate(),
        };
      });

      return logs;
    } catch (error) {
      console.error('Error fetching logs:', error);
      return [];
    }
  }

  const getLogsAfter = async (dateString: string, afterTimestamp?: Date) => {
    const db = getFirestore();
    const logsRef = collection(db, 'logs');

    const start = dayjs(dateString).startOf('day').toDate();
    const end = dayjs(dateString).endOf('day').toDate();

    let q = query(
      logsRef,
      ...storeFilter,
      where('timestamp', '>=', start),
      where('timestamp', '<=', end),
      orderBy('timestamp', 'desc'),
    );
    console.log('afterTimestamp', afterTimestamp);
    if (afterTimestamp) {
      q = query(q, startAfter(Timestamp.fromDate(afterTimestamp)));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...(data as Log),
        timestamp: data.timestamp.toDate(),
      };
    });
  };

  async function getLogsByPhoneNumber(phoneNumber: string): Promise<Log[]> {
    try {
      const db = getFirestore();
      const logsRef = collection(db, 'logs');

      const logsQuery = query(
        logsRef,
        ...storeFilter,
        where('phone_number', '==', phoneNumber),
        orderBy('timestamp', 'desc'),
        limit(50),
      );

      const querySnapshot = await getDocs(logsQuery);

      console.log('Logs fetched successfully!');

      const logs =
        querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...(data as Log),
            timestamp: data.timestamp.toDate(),
          };
        }) || [];

      return logs;
    } catch (error) {
      console.error('Error fetching logs:', error);
      return [];
    }
  }

  async function addLog(log: LogDto) {
    try {
      const db = getFirestore();
      const logsRef = collection(db, 'logs');
      await setDoc(doc(logsRef), log);
      console.log('Log posted successfully!');
    } catch (error) {
      console.error('Error posting log:', error);
    }
  }

  /**
   * 이 매장에 적립/사용 기록이 한 건이라도 있는지.
   *
   * "아직 첫 적립을 못 한 매장"을 가려내는 용도다 — 개수는 필요 없어서 limit(1)로
   * 존재 여부만 본다(읽기 1건). `code`를 주면 훅 인자와 무관하게 그 매장을 본다:
   * 스위처는 매장 세션에 들어가기 전이라 storeCode가 없는 채로 여러 매장을 훑는다.
   *
   * 실패하면 `true`(=있다)로 답한다. 안내 배너를 못 띄우는 쪽이, 잘 쓰고 있는
   * 점주에게 "아직 적립이 없어요"를 잘못 띄우는 쪽보다 낫다.
   */
  async function hasAnyLog(code?: string | null): Promise<boolean> {
    const target = code ?? storeCode;
    if (!target) return true;
    try {
      const db = getFirestore();
      const snapshot = await getDocs(
        query(
          collection(db, 'logs'),
          where('store_code', '==', target),
          limit(1),
        ),
      );
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking logs:', error);
      return true;
    }
  }

  /** 회원 수. 문서 수가 아니라 **고유 전화번호 수**를 센다. */
  async function getUserCount(): Promise<number> {
    try {
      const db = getFirestore();
      const snapshot = storeCode
        ? await getDocs(
            query(
              collection(db, 'users'),
              where('store_code', '==', storeCode),
            ),
          )
        : await getDocs(collection(db, 'users'));
      // 레거시/복합 문서가 공존해 문서 수를 그대로 쓰면 실제보다 많이 나온다.
      return dedupeByPhone(snapshot.docs).length;
    } catch (error) {
      console.error('Error getting user count:', error);
      return 0;
    }
  }

  async function getLogsInRange(
    startDate: string,
    endDate: string,
  ): Promise<Log[]> {
    try {
      const db = getFirestore();
      const logsRef = collection(db, 'logs');
      const start = dayjs(startDate).startOf('day').toDate();
      const end = dayjs(endDate).endOf('day').toDate();

      const PAGE_SIZE = 500;
      const results: Log[] = [];
      let cursor: any;

      while (true) {
        let q = query(
          logsRef,
          ...storeFilter,
          where('timestamp', '>=', start),
          where('timestamp', '<=', end),
          orderBy('timestamp', 'desc'),
          limit(PAGE_SIZE),
        );
        if (cursor) {
          q = query(q, startAfter(cursor));
        }
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        for (const d of snapshot.docs) {
          const data = d.data();
          results.push({
            id: d.id,
            ...(data as Log),
            timestamp: data.timestamp.toDate(),
          } as Log);
        }

        if (snapshot.docs.length < PAGE_SIZE) break;
        cursor = snapshot.docs[snapshot.docs.length - 1];
      }

      return results;
    } catch (error) {
      console.error('Error fetching logs in range:', error);
      return [];
    }
  }

  async function getAllUsers(): Promise<Array<User & {phone: string}>> {
    try {
      const db = getFirestore();
      let snapshot;
      if (storeCode) {
        const q = query(
          collection(db, 'users'),
          where('store_code', '==', storeCode),
        );
        snapshot = await getDocs(q);
      } else {
        snapshot = await getDocs(collection(db, 'users'));
      }
      return dedupeByPhone(snapshot.docs);
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  }

  async function getAllLogs(): Promise<Log[]> {
    try {
      const db = getFirestore();
      const logsRef = collection(db, 'logs');
      const PAGE_SIZE = 500;
      const results: Log[] = [];
      let cursor: any;
      while (true) {
        let q = query(
          logsRef,
          ...storeFilter,
          orderBy('timestamp', 'desc'),
          limit(PAGE_SIZE),
        );
        if (cursor) q = query(q, startAfter(cursor));
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;
        for (const d of snapshot.docs) {
          const data = d.data();
          results.push({
            id: d.id,
            ...(data as Log),
            timestamp: data.timestamp.toDate(),
          } as Log);
        }
        if (snapshot.docs.length < PAGE_SIZE) break;
        cursor = snapshot.docs[snapshot.docs.length - 1];
      }
      return results;
    } catch (error) {
      console.error('Error fetching all logs:', error);
      return [];
    }
  }

  async function deleteLogsInRange(startDate: string, endDate: string) {
    try {
      const db = getFirestore();
      const logsRef = collection(db, 'logs');

      const start = dayjs(startDate).startOf('day').toDate();
      const end = dayjs(endDate).endOf('day').toDate();

      const q = query(
        logsRef,
        ...storeFilter,
        where('timestamp', '>=', start),
        where('timestamp', '<=', end),
      );

      const snapshot = await getDocs(q);

      const batchSize = 500;
      const totalDocs = snapshot.docs.length;
      console.log(`삭제 대상 문서 수: ${totalDocs}개`);

      for (let i = 0; i < totalDocs; i += batchSize) {
        const batch = db.batch();
        const chunk = snapshot.docs.slice(i, i + batchSize);

        chunk.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`🔥 ${chunk.length}개 삭제 완료`);
      }

      console.log('✅ 로그 삭제 완료!');
      return true;
    } catch (error) {
      console.error('❌ 로그 삭제 실패:', error);
      return false;
    }
  }

  /**
   * 고객 탈퇴 — 키오스크(익명 세션)에서 호출된다.
   *
   * 본인 문서만 단건 삭제하고, 적립 이력(logs) 정리는 서버(onUserDeleted)에 맡긴다.
   * 클라이언트가 logs를 직접 지우려면 `where(phone_number == ...)` 쿼리가 필요한데,
   * 보안 규칙은 쿼리의 필터 조건을 검사할 수 없어서 "logs 목록 조회"를 열어줘야 한다.
   * 그러면 익명 세션 아무나 매장 전체 로그(= 전화번호 전량)를 덤프할 수 있다.
   * 그래서 이 경로만 서버로 넘긴다.
   */
  async function deleteUserAccount(phoneNumber: string): Promise<boolean> {
    try {
      const db = getFirestore();
      const resolved = await _resolveUserDoc(phoneNumber);
      const docId = resolved ? resolved.id : _docId(phoneNumber);

      await deleteDoc(doc(db, 'users', docId));
      await deleteDoc(doc(db, 'terms', docId));

      console.log('✅ 회원 탈퇴 완료(이력 정리는 서버가 이어서 수행):', phoneNumber);
      return true;
    } catch (error) {
      console.error('❌ 회원 탈퇴 실패:', error);
      return false;
    }
  }

  /**
   * 기존 유저에 store_code 일괄 추가 (1회용 마이그레이션).
   *
   * ⚠️ 현재 어디서도 호출하지 않으며, 보안 규칙상 더 이상 동작하지 않는다.
   * users 컬렉션 전체 조회는 이제 금지다(전화번호 대량 유출 경로). 남은 레거시
   * 문서를 정리해야 한다면 Admin SDK로 서버에서 돌릴 것.
   */
  async function migrateUsersStoreCode(): Promise<number> {
    if (!storeCode) return 0;
    try {
      const db = getFirestore();
      const snapshot = await getDocs(collection(db, 'users'));
      const docsToMigrate = snapshot.docs.filter(d => !d.data().store_code);

      const BATCH_SIZE = 500;
      for (let i = 0; i < docsToMigrate.length; i += BATCH_SIZE) {
        const batch = db.batch();
        docsToMigrate.slice(i, i + BATCH_SIZE).forEach(d => {
          batch.update(d.ref, {store_code: storeCode});
        });
        await batch.commit();
      }

      console.log(`✅ ${docsToMigrate.length}명 store_code 마이그레이션 완료`);
      return docsToMigrate.length;
    } catch (error) {
      console.error('❌ 마이그레이션 실패:', error);
      return 0;
    }
  }

  // findStoreByPhone은 제거했다. stores 컬렉션 목록 조회를 규칙에서 닫았기 때문에
  // 동작하지 않고, 애초에 "번호로 매장 찾기"가 탈취 경로의 입구였다.
  // 매장 코드로 단건 조회하는 getStores()를 쓸 것.

  async function updateStoreConfig(config: StoreConfig) {
    if (!storeCode) throw new Error('storeCode is required');
    const db = getFirestore();
    const storeRef = doc(db, 'stores', storeCode);
    await updateDoc(storeRef, {config});
  }

  // ─── 이메일 계정(점주) — owners/{uid} ──────────────────────────

  /** 계정 프로필 조회 */
  async function getOwnerProfile(uid: string): Promise<Owner | undefined> {
    try {
      const db = getFirestore();
      const snap = await getDoc(doc(db, 'owners', uid));
      return snap.exists ? (snap.data() as Owner) : undefined;
    } catch (error) {
      console.error('Error getting owner profile:', error);
      return undefined;
    }
  }

  /** 계정 최초 생성 (이미 있으면 기존 프로필 반환) */
  async function ensureOwnerProfile(uid: string, email: string): Promise<Owner> {
    const db = getFirestore();
    const ref = doc(db, 'owners', uid);
    const snap = await getDoc(ref);
    if (snap.exists) return snap.data() as Owner;
    const owner: Owner = {
      email,
      createdAt: new Date().toISOString(),
      storeCodes: [],
      slotLimit: DEFAULT_SLOT_LIMIT,
      subscription: null,
    };
    await setDoc(ref, owner);
    return owner;
  }

  /**
   * 레거시 계정(구글/애플 제공자 id 기반)을 Firebase uid 기반으로 이전한다.
   *
   * 배경: Firebase Auth 도입 전에는 `owners/{제공자id}`로 계정을 저장했다. 이제
   * 보안 규칙이 `request.auth.uid`(= Firebase uid)로 소유권을 검증하므로, 기존
   * 점주가 재로그인하면 문서 키를 새 uid로 옮겨줘야 매장을 잃지 않는다.
   *
   * 안전장치:
   *  - 레거시 문서는 **지우지 않고** `migratedTo`만 남긴다. 문제가 생기면 되돌릴 수 있고,
   *    규칙상 어차피 아무도 못 읽는다.
   *  - 이미 `owners/{fbUid}`가 있으면 마이그레이션을 건너뛴다(재실행 안전).
   *  - stores.ownerId도 같이 새 uid로 옮긴다. 안 옮기면 매장 쓰기 권한이 끊긴다.
   *
   * 참고: `ownerTokens/{제공자id}`(애플 refresh token)는 클라이언트가 접근할 수 없어
   * 여기서 못 옮긴다. 애플 로그인 시 registerAppleToken이 새 uid로 다시 저장하므로
   * 자연히 대체되고, 남은 레거시 문서는 서버에서 정리한다.
   *
   * @returns 이 계정의 최종 프로필
   */
  async function migrateLegacyOwner(
    fbUid: string,
    legacyUid: string,
    email: string,
  ): Promise<Owner> {
    const db = getFirestore();
    const newRef = doc(db, 'owners', fbUid);

    const newSnap = await getDoc(newRef);
    if (newSnap.exists) return newSnap.data() as Owner;

    // 제공자 id와 Firebase uid가 같을 리는 없지만, 같다면 이전할 게 없다.
    if (legacyUid && legacyUid !== fbUid) {
      const legacyRef = doc(db, 'owners', legacyUid);
      const legacySnap = await getDoc(legacyRef);

      if (legacySnap.exists) {
        const legacy = legacySnap.data() as Owner & {migratedTo?: string};
        const codes = legacy.storeCodes ?? [];

        const batch = db.batch();
        batch.set(newRef, {
          ...legacy,
          email: legacy.email || email,
          legacyUid,
          migratedAt: new Date().toISOString(),
        });
        batch.update(legacyRef, {migratedTo: fbUid});
        codes.forEach(code => {
          batch.update(doc(db, 'stores', code), {ownerId: fbUid});
        });
        await batch.commit();

        console.log(
          `✅ 계정 이전 완료: ${legacyUid} → ${fbUid} (매장 ${codes.length}개)`,
        );
        return {...legacy, email: legacy.email || email};
      }
    }

    // 레거시 계정이 없으면 신규 가입
    return ensureOwnerProfile(fbUid, email);
  }

  // claimStoresByPhone(전화번호로 기존 매장 흡수)은 제거했다.
  //
  // 번호 소유를 전혀 검증하지 않아서, 점주 연락처만 알면 남의 매장을 자기 계정으로
  // 가져갈 수 있었다. 매장을 쥐면 그 매장 고객 전화번호 전량까지 열린다(ownsStore).
  // 게다가 한 번 넘어가면 규칙상 원래 점주도 되찾을 수 없다.
  //
  // 신버전에서는 매장이 로그인된 계정에서 생성되므로 이 경로 자체가 필요 없다.
  // 주인 없는 레거시 매장은 서버(Admin SDK 스크립트)에서 연결한다.
  // 앞으로 계정 간 이전이 필요해지면 "인증된 계정 → 인증된 계정" 이전으로 만들 것.

  /** 슬롯 여유 확인 */
  /**
   * 남은 슬롯. 삭제 대기 매장은 세지 않는다 — 자리를 비우려고 지운 사람에게
   * 가득 찼다고 하면 지운 의미가 없다. (판정은 getOwnerStoreLists가 한다)
   */
  async function getOwnerSlotInfo(
    uid: string,
  ): Promise<{current: number; limit: number; canAdd: boolean}> {
    return (await getOwnerStoreLists(uid)).slot;
  }

  /**
   * 방금 만든 매장을 계정의 슬롯 목록에 추가 (슬롯 초과 시 false).
   * 이미 들어 있으면 true.
   *
   * stores.ownerId는 registerStore가 생성 시점에 이미 박아둔다. 여기서 매장 문서를
   * 건드리지 않는 이유가 그것이다 — 나중에 주인을 채우는 방식이면 "주인 없는 매장은
   * 누구나 쓸 수 있다"는 규칙이 필요해지고, 그게 곧 탈취 경로였다.
   */
  async function linkStoreToOwner(
    uid: string,
    code: string,
  ): Promise<boolean> {
    try {
      const db = getFirestore();
      const ownerRef = doc(db, 'owners', uid);
      const ownerSnap = await getDoc(ownerRef);
      const codes: string[] = ownerSnap.exists
        ? ownerSnap.data()?.storeCodes ?? []
        : [];
      if (codes.includes(code)) return true;
      const limit: number = ownerSnap.exists
        ? ownerSnap.data()?.slotLimit ?? DEFAULT_SLOT_LIMIT
        : DEFAULT_SLOT_LIMIT;
      if (codes.length >= limit) return false;

      await updateDoc(ownerRef, {storeCodes: [...codes, code]});
      return true;
    } catch (error) {
      console.error('Error linking store to owner:', error);
      return false;
    }
  }

  /**
   * 계정에 연결된 매장을 운영 중 / 삭제 대기로 갈라 한 번에 돌려준다.
   *
   * 세 가지(목록·삭제 대기·슬롯)를 각각 조회하면 같은 매장 문서를 세 번 읽는다.
   * 스위처는 뜰 때마다 이걸 부르므로 한 번에 훑고 나눈다.
   *
   * 슬롯은 삭제 대기를 빼고 센다. 자리를 비우려고 지운 사람에게 "슬롯이 가득
   * 찼다"고 하면 지운 의미가 없다.
   */
  async function getOwnerStoreLists(uid: string): Promise<{
    active: {storeCode: string; name: string}[];
    deleted: {storeCode: string; name: string; deletedAt: string | null}[];
    slot: {current: number; limit: number; canAdd: boolean};
  }> {
    const limitValue = DEFAULT_SLOT_LIMIT;
    const empty = {
      active: [],
      deleted: [],
      slot: {current: 0, limit: limitValue, canAdd: true},
    };
    try {
      const owner = await getOwnerProfile(uid);
      const codes = owner?.storeCodes ?? [];
      const db = getFirestore();

      const active: {storeCode: string; name: string}[] = [];
      const deleted: {
        storeCode: string;
        name: string;
        deletedAt: string | null;
      }[] = [];

      for (const code of codes) {
        const snap = await getDoc(doc(db, 'stores', code));
        // 실삭제까지 끝난 매장은 문서가 없다. 목록에서 조용히 빠진다.
        if (!snap.exists) continue;
        const data = snap.data();
        const name = data?.name ?? code;
        if (data?.lifecycle === 'pending_deletion') {
          deleted.push({storeCode: code, name, deletedAt: data?.deletedAt ?? null});
        } else {
          active.push({storeCode: code, name});
        }
      }

      const limitTotal = owner?.slotLimit ?? limitValue;
      return {
        active,
        deleted,
        slot: {
          current: active.length,
          limit: limitTotal,
          canAdd: active.length < limitTotal,
        },
      };
    } catch (error) {
      console.error('Error getting owner store lists:', error);
      return empty;
    }
  }

  /** 계정에 연결된 스토어 목록 (운영 중인 것만) */
  async function getOwnerStores(
    uid: string,
  ): Promise<{storeCode: string; name: string}[]> {
    return (await getOwnerStoreLists(uid)).active;
  }

  /**
   * 매장 삭제 요청 — soft delete.
   *
   * 계정 탈퇴와 같은 모양이다. 문서를 지우지 않고 `lifecycle`만 바꾼다.
   * 점주 목록에서는 즉시 사라지지만 고객 전화번호와 적립 이력은 유예 기간
   * 동안 남는다 — 잘못 눌렀을 때 되돌릴 방법이 없으면 안 되기 때문이다.
   * 실삭제는 스케줄 Function이 한다.
   *
   * `owners.storeCodes`에서는 **빼지 않는다.** 여기서 빼면 그 매장을 다시 찾을
   * 길이 없어져서, 되돌리기가 우리에게 연락하는 수동 절차가 되어버린다.
   * 코드는 그대로 두고 목록을 lifecycle로 가른다(getOwnerStoreLists).
   * 규칙의 ownsStore도 storeCodes를 보므로, 유예 동안 점주가 그 매장을 열어
   * 확인한 뒤 되돌릴 수 있다는 뜻이기도 하다.
   */
  async function requestStoreDeletion(code: string): Promise<boolean> {
    try {
      await updateDoc(doc(getFirestore(), 'stores', code), {
        lifecycle: 'pending_deletion',
        deletedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error requesting store deletion:', error);
      return false;
    }
  }

  /**
   * 삭제 요청을 되돌린다. 유예가 지나 실삭제된 뒤에는 문서가 없어 실패한다.
   *
   * 슬롯 검사를 여기서 한 번 더 하는 이유: 매장을 지우고 그 자리에 새 매장을
   * 만든 다음 되돌리면 한도를 넘는다. 화면에서 막더라도 마지막 관문은
   * 쓰기 직전에 있어야 한다.
   */
  async function restoreStore(
    uid: string,
    code: string,
  ): Promise<{ok: true} | {ok: false; reason: 'slot_full' | 'failed'}> {
    try {
      const {slot} = await getOwnerStoreLists(uid);
      if (!slot.canAdd) return {ok: false, reason: 'slot_full'};

      await updateDoc(doc(getFirestore(), 'stores', code), {
        lifecycle: 'active',
        deletedAt: null,
      });
      return {ok: true};
    } catch (error) {
      console.error('Error restoring store:', error);
      return {ok: false, reason: 'failed'};
    }
  }

  /**
   * 점주 계정 탈퇴 요청 — soft delete. 즉시 삭제하지 않고 30일 유예 상태로 표시한다.
   * 실제 삭제(문서 제거 + Apple revoke + 매장 소유 해제)는 스케줄 Function이 담당.
   * 성공 시 true.
   */
  async function requestAccountDeletion(uid: string): Promise<boolean> {
    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'owners', uid), {
        accountStatus: 'pending_deletion',
        deletedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error requesting account deletion:', error);
      return false;
    }
  }

  /** 유예 기간 내 탈퇴 철회 — 계정을 다시 활성 상태로 되돌린다. 성공 시 true. */
  async function restoreAccount(uid: string): Promise<boolean> {
    try {
      const db = getFirestore();
      await updateDoc(doc(db, 'owners', uid), {
        accountStatus: 'active',
        deletedAt: null,
      });
      return true;
    } catch (error) {
      console.error('Error restoring account:', error);
      return false;
    }
  }

  return {
    addUser,
    getUser,
    updateUser,
    registerStore,
    getStores,
    enterNumber,
    updateSession,
    addLog,
    getLogs,
    getLogsAfter,
    hasAnyLog,
    getUserCount,
    getLogsInRange,
    deleteLogsInRange,
    getLogsByPhoneNumber,
    getAllUsers,
    getAllLogs,
    deleteUserAccount,
    resolveUserDocId,
    migrateUsersStoreCode,
    updateStoreConfig,
    // 이메일 계정(점주)
    getOwnerProfile,
    ensureOwnerProfile,
    migrateLegacyOwner,
    getOwnerSlotInfo,
    linkStoreToOwner,
    getOwnerStores,
    getOwnerStoreLists,
    requestAccountDeletion,
    requestStoreDeletion,
    restoreStore,
    restoreAccount,
  };
};

export default useFirestore;
