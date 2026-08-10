/**
 * users 문서에 비정규화해 두는 최근 적립/사용 이력.
 *
 * 왜 `logs` 컬렉션을 안 읽나: 규칙상 logs 조회는 점주 전용이다
 * (firestore.rules — 익명에 열면 매장 전화번호가 통째로 새어나간다).
 * 고객 화면은 익명 세션이라 자기 이력조차 못 읽는다. 대신 적립/사용할 때
 * 관리자가 users 문서에 최근 몇 건을 같이 적어두고, 고객 화면은 이미
 * 구독 중인 그 문서에서 읽는다 — 규칙 변경도, 추가 조회도 없다.
 */

import dayjs from 'dayjs';

/** 문서에 유지할 최대 건수. 화면엔 이보다 적게 보여도 여유를 둔다. */
export const RECENT_LOG_LIMIT = 10;

/** 새 이력을 맨 앞에 넣고 상한까지 자른다. */
export function pushRecentLog(
  existing: RecentLog[] | undefined,
  entry: Omit<RecentLog, 'at'> & {at?: string},
): RecentLog[] {
  const next: RecentLog = {
    action: entry.action,
    amount: entry.amount,
    at: entry.at ?? new Date().toISOString(),
    ...(entry.note ? {note: entry.note} : {}),
  };
  return [next, ...(existing ?? [])].slice(0, RECENT_LOG_LIMIT);
}

/** '8월 4일 01:03' */
export function formatRecentLogTime(at: string): string {
  return dayjs(at).format('M월 D일 HH:mm');
}
