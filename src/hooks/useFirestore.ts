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
        phase: 'americano',
        coupons: {},
        // 레거시 호환
        americanoCoupons: 0,
        beverageCoupons: 0,
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

  async function registerStore(data: {
    name: string;
    ownerPhone: string;
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

  async function getUserCount(): Promise<number> {
    try {
      const db = getFirestore();
      if (storeCode) {
        const q = query(
          collection(db, 'users'),
          where('store_code', '==', storeCode),
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
      }
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.size;
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
      return snapshot.docs.map(d => ({
        phone: d.id,
        ...(d.data() as User),
      }));
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

  async function deleteUserAccount(phoneNumber: string): Promise<boolean> {
    try {
      const db = getFirestore();
      const resolved = await _resolveUserDoc(phoneNumber);
      const docId = resolved ? resolved.id : _docId(phoneNumber);

      // 1. users 문서 삭제
      await deleteDoc(doc(db, 'users', docId));

      // 2. terms 문서 삭제
      await deleteDoc(doc(db, 'terms', docId));

      // 3. 해당 유저의 logs 전부 삭제
      const logsRef = collection(db, 'logs');
      const logsQuery = query(
        logsRef,
        ...storeFilter,
        where('phone_number', '==', phoneNumber),
      );
      const snapshot = await getDocs(logsQuery);

      const batchSize = 500;
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        snapshot.docs.slice(i, i + batchSize).forEach(d => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }

      console.log('✅ 회원 탈퇴 완료:', phoneNumber);
      return true;
    } catch (error) {
      console.error('❌ 회원 탈퇴 실패:', error);
      return false;
    }
  }

  /** 기존 유저에 store_code 일괄 추가 (1회용 마이그레이션) */
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

  async function findStoreByPhone(
    phone: string,
  ): Promise<{storeCode: string; name: string}[]> {
    try {
      const db = getFirestore();
      const q = query(
        collection(db, 'stores'),
        where('ownerPhone', '==', normalizePhone(phone)),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({storeCode: d.id, name: d.data().name}));
    } catch (error) {
      console.error('Error finding store by phone:', error);
      return [];
    }
  }

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
   * 전화번호로 등록된 기존 스토어를 계정에 흡수(claim).
   * 아직 주인이 없거나(레거시) 본인 소유인 스토어만 연결한다.
   * 기존 다점포 점주는 보유 수만큼 슬롯을 grandfather 한다.
   * @returns 새로 연결된 스토어 코드 목록
   */
  async function claimStoresByPhone(
    uid: string,
    phone: string,
  ): Promise<string[]> {
    try {
      const db = getFirestore();
      const normalized = normalizePhone(phone);
      const snapshot = await getDocs(
        query(
          collection(db, 'stores'),
          where('ownerPhone', '==', normalized),
        ),
      );
      const claimable = snapshot.docs.filter(d => {
        const owner = d.data().ownerId;
        return !owner || owner === uid;
      });
      if (claimable.length === 0) return [];

      const ownerRef = doc(db, 'owners', uid);
      const ownerSnap = await getDoc(ownerRef);
      const existingCodes: string[] = ownerSnap.exists
        ? ownerSnap.data()?.storeCodes ?? []
        : [];
      const merged = Array.from(
        new Set([...existingCodes, ...claimable.map(d => d.id)]),
      );
      const currentLimit: number = ownerSnap.exists
        ? ownerSnap.data()?.slotLimit ?? DEFAULT_SLOT_LIMIT
        : DEFAULT_SLOT_LIMIT;

      const batch = db.batch();
      claimable.forEach(d => batch.update(d.ref, {ownerId: uid}));
      batch.update(ownerRef, {
        storeCodes: merged,
        slotLimit: Math.max(currentLimit, merged.length),
      });
      await batch.commit();

      return claimable.map(d => d.id);
    } catch (error) {
      console.error('Error claiming stores by phone:', error);
      return [];
    }
  }

  /** 슬롯 여유 확인 */
  async function getOwnerSlotInfo(
    uid: string,
  ): Promise<{current: number; limit: number; canAdd: boolean}> {
    const owner = await getOwnerProfile(uid);
    const current = owner?.storeCodes?.length ?? 0;
    const limit = owner?.slotLimit ?? DEFAULT_SLOT_LIMIT;
    return {current, limit, canAdd: current < limit};
  }

  /** 스토어를 계정에 연결 (슬롯 초과 시 false). 이미 연결돼 있으면 true. */
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

      const batch = db.batch();
      batch.update(doc(db, 'stores', code), {ownerId: uid});
      batch.update(ownerRef, {storeCodes: [...codes, code]});
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error linking store to owner:', error);
      return false;
    }
  }

  /** 계정에 연결된 스토어 목록 (스위처용) */
  async function getOwnerStores(
    uid: string,
  ): Promise<{storeCode: string; name: string}[]> {
    try {
      const owner = await getOwnerProfile(uid);
      const codes = owner?.storeCodes ?? [];
      const db = getFirestore();
      const results: {storeCode: string; name: string}[] = [];
      for (const code of codes) {
        const snap = await getDoc(doc(db, 'stores', code));
        if (snap.exists) {
          results.push({storeCode: code, name: snap.data()?.name ?? code});
        }
      }
      return results;
    } catch (error) {
      console.error('Error getting owner stores:', error);
      return [];
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
    findStoreByPhone,
    // 이메일 계정(점주)
    getOwnerProfile,
    ensureOwnerProfile,
    claimStoresByPhone,
    getOwnerSlotInfo,
    linkStoreToOwner,
    getOwnerStores,
    requestAccountDeletion,
    restoreAccount,
  };
};

export default useFirestore;
