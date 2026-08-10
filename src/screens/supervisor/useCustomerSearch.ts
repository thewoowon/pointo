import {useCallback, useEffect, useMemo, useState} from 'react';
import {useAuth, useFirestore} from '../../hooks';

export type CustomerHit = User & {phone: string};

/** 이 자리수부터 결과를 보여준다. 너무 짧으면 매장 전체가 다 걸린다. */
export const MIN_QUERY_LENGTH = 2;

/**
 * 매장 귀속 고객 검색 (관리자 전용).
 *
 * Firestore는 substring 쿼리를 못 하므로 시트가 열릴 때 매장 유저를 1회 통째로
 * 읽어와 메모리에서 필터한다. 매장당 수백~수천 명 규모라 체감 지연이 없고,
 * 타이핑마다 쿼리를 날리는 것보다 읽기 비용도 싸다.
 */
export function useCustomerSearch(visible: boolean) {
  const {storeCode} = useAuth();
  const {getAllUsers} = useFirestore(storeCode);

  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const users = await getAllUsers();
    setCustomers(users);
    setLoading(false);
    // getAllUsers는 매 렌더 새로 만들어지므로 의존성에서 제외 —
    // storeCode가 실제 입력이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCode]);

  // 시트가 열릴 때마다 새로 읽는다. 닫히면 입력을 비운다.
  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }
    load();
  }, [visible, load]);

  const digits = query.replace(/\D/g, '');

  const results = useMemo(() => {
    if (!customers || digits.length < MIN_QUERY_LENGTH) return [];
    return customers
      .filter(c => c.phone.includes(digits))
      .sort((a, b) => {
        // 뒷자리 입력이 실사용 대부분이라 끝자리 일치를 먼저 띄운다.
        const aTail = a.phone.endsWith(digits) ? 1 : 0;
        const bTail = b.phone.endsWith(digits) ? 1 : 0;
        if (aTail !== bTail) return bTail - aTail;
        return (b.last_used ?? '').localeCompare(a.last_used ?? '');
      });
  }, [customers, digits]);

  return {
    query,
    setQuery,
    digits,
    results,
    loading,
    /** 최소 자리수를 채웠는데 결과가 없는 상태 (빈 결과 안내용) */
    isEmpty:
      !loading && digits.length >= MIN_QUERY_LENGTH && results.length === 0,
  };
}
