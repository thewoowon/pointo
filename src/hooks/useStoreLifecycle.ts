import {useEffect, useState} from 'react';
import {doc, getFirestore, onSnapshot} from '@react-native-firebase/firestore';

export type StoreLifecycle = 'loading' | 'active' | 'deleted' | 'missing';

/**
 * 매장이 아직 살아 있는가.
 *
 * 점주가 매장을 지워도 문서는 유예 기간 동안 남는다(되돌릴 창을 남기려고).
 * 그런데 그 사이에도 카운터에 세워둔 기기는 아무 일 없다는 듯 계속 돌아서,
 * 손님은 곧 사라질 매장에 적립을 쌓게 된다. 지운 쪽은 지웠다고 믿고 있는데
 * 잔액이 계속 늘어나는 상태라, 유예가 끝나는 날 한꺼번에 사라진다.
 *
 * 그래서 삭제 표시를 실시간으로 본다. 폴링이 아니라 구독인 이유는, 기기를
 * 고객 모드로 잠가두면 며칠씩 켜둔 채 아무도 손대지 않기 때문이다 — 다음
 * 재시작을 기다릴 수 없다.
 *
 * 문서가 아예 없는 경우(`missing`)도 갈라둔다. 유예가 끝나 실삭제된 매장이
 * 이 상태이고, 화면에 다른 말을 해줘야 한다.
 */
const useStoreLifecycle = (storeCode?: string | null): StoreLifecycle => {
  const [state, setState] = useState<StoreLifecycle>('loading');

  useEffect(() => {
    if (!storeCode) {
      setState('active');
      return;
    }

    setState('loading');
    const stop = onSnapshot(
      doc(getFirestore(), 'stores', storeCode),
      snap => {
        if (!snap.exists) {
          setState('missing');
          return;
        }
        setState(
          snap.data()?.lifecycle === 'pending_deletion' ? 'deleted' : 'active',
        );
      },
      error => {
        // 읽기에 실패했다고 매장을 막지는 않는다. 카운터에서 잠깐 네트워크가
        // 끊겼을 뿐인데 영업을 멈추는 쪽이 훨씬 나쁘다.
        console.error('Error watching store lifecycle:', error);
        setState('active');
      },
    );

    return stop;
  }, [storeCode]);

  return state;
};

export default useStoreLifecycle;
