import {useEffect, useRef, useState} from 'react';
import {doc, getFirestore, onSnapshot} from '@react-native-firebase/firestore';
import {DEFAULT_SLOT_LIMIT} from './useFirestore';

export type OwnerStore = {storeCode: string; name: string};
export type DeletedOwnerStore = OwnerStore & {deletedAt: string | null};

export type OwnerStores = {
  active: OwnerStore[];
  deleted: DeletedOwnerStore[];
  slot: {current: number; limit: number; canAdd: boolean};
  isLoading: boolean;
};

const EMPTY: OwnerStores = {
  active: [],
  deleted: [],
  slot: {current: 0, limit: DEFAULT_SLOT_LIMIT, canAdd: true},
  isLoading: true,
};

/**
 * 계정의 매장 목록을 실시간으로 본다.
 *
 * 예전엔 화면에 포커스가 잡힐 때 한 번 읽었다. 그런데 점주는 기기를 두 대
 * 쓰는 경우가 흔하다(카운터 태블릿 + 개인 폰). 한쪽에서 매장을 지우거나
 * 되돌려도 다른 쪽은 그 화면을 떠났다 돌아오기 전까지 옛 목록을 들고 있었고,
 * 그 상태에서 같은 매장을 또 지우거나 이미 되돌린 매장을 되돌리려 들었다.
 *
 * 구독은 두 겹이다. 계정 문서가 매장 **코드 목록**을 들고 있고, 이름과 삭제
 * 표시는 각 매장 문서에 있어서, 계정을 구독한 뒤 코드마다 매장을 구독한다.
 * 코드 목록이 실제로 바뀌었을 때만 안쪽 구독을 다시 건다 — 매장 이름 한 번
 * 바뀔 때마다 전부 끊었다 다시 걸면 목록이 깜빡인다.
 */
const useOwnerStores = (uid?: string | null): OwnerStores => {
  const [state, setState] = useState<OwnerStores>(EMPTY);

  /** 코드 → 매장 문서 스냅샷. 한 건이 바뀌면 여기만 갱신하고 다시 조립한다. */
  const storesRef = useRef(
    new Map<string, {name: string; lifecycle?: string; deletedAt?: string | null} | null>(),
  );

  useEffect(() => {
    if (!uid) {
      setState({...EMPTY, isLoading: false});
      return;
    }

    setState(EMPTY);
    storesRef.current = new Map();

    const db = getFirestore();
    let storeStops: (() => void)[] = [];
    let watchedKey = '';
    let slotLimit = DEFAULT_SLOT_LIMIT;

    /** 지금까지 받은 매장 문서들로 화면이 쓸 모양을 만든다. */
    const publish = (codes: string[]) => {
      const active: OwnerStore[] = [];
      const deleted: DeletedOwnerStore[] = [];
      let pending = false;

      for (const code of codes) {
        if (!storesRef.current.has(code)) {
          // 아직 첫 스냅샷이 안 온 매장. 목록을 반쪽만 보여주지 않는다.
          pending = true;
          continue;
        }
        const data = storesRef.current.get(code);
        // null = 문서 없음. 유예가 끝나 실삭제된 매장이 여기 해당한다.
        if (!data) continue;
        if (data.lifecycle === 'pending_deletion') {
          deleted.push({
            storeCode: code,
            name: data.name,
            deletedAt: data.deletedAt ?? null,
          });
        } else {
          active.push({storeCode: code, name: data.name});
        }
      }

      setState({
        active,
        deleted,
        slot: {
          current: active.length,
          limit: slotLimit,
          canAdd: active.length < slotLimit,
        },
        isLoading: pending,
      });
    };

    const stopOwner = onSnapshot(
      doc(db, 'owners', uid),
      ownerSnap => {
        const owner = ownerSnap.data();
        const codes: string[] = owner?.storeCodes ?? [];
        slotLimit = owner?.slotLimit ?? DEFAULT_SLOT_LIMIT;

        const key = codes.join(',');
        if (key !== watchedKey) {
          watchedKey = key;
          storeStops.forEach(stop => stop());
          storeStops = codes.map(code =>
            onSnapshot(
              doc(db, 'stores', code),
              storeSnap => {
                const data = storeSnap.data();
                storesRef.current.set(
                  code,
                  storeSnap.exists && data ?
                    {
                      name: data.name ?? code,
                      lifecycle: data.lifecycle,
                      deletedAt: data.deletedAt ?? null,
                    } :
                    null,
                );
                publish(codes);
              },
              error => {
                console.error(`Error watching store ${code}:`, error);
                // 못 읽는 매장 하나가 목록 전체를 로딩에 묶어두면 안 된다.
                storesRef.current.set(code, null);
                publish(codes);
              },
            ),
          );
        }

        publish(codes);
      },
      error => {
        console.error('Error watching owner stores:', error);
        setState(prev => ({...prev, isLoading: false}));
      },
    );

    return () => {
      stopOwner();
      storeStops.forEach(stop => stop());
    };
  }, [uid]);

  return state;
};

export default useOwnerStores;
