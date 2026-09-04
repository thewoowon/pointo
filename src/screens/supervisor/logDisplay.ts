import type {Theme} from '../../theme';

// 적립내역 화면 공용 표시 규칙 (마스킹 + pill 색). MainScreen·바텀시트·상세뷰가 공유.

/** 상세/시트용 마스킹 표기. 예) 01012345678 → '010 **** 5678' */
export const maskPhone = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 7) return digits;
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head} **** ${tail}`;
};

/**
 * pill 문구. 보통은 `적립 3`처럼 수량까지 붙인다.
 *
 * 쿠폰 사용만 예외 — stamp가 0으로 기록돼서 수량을 붙이면 `사용 0`이 된다.
 * 0장 쓴 게 아니라 스탬프 증감이 없는 거라, 이 경우엔 라벨만 쓴다.
 * 무슨 쿠폰이 몇 장 나갔는지는 note에 남아 있고 상세에서 보여준다.
 */
export const logPillText = (log: Log, label: string): string =>
  log.stamp === 0 ? label : `${label} ${log.stamp}`;

/**
 * 로그 한 건을 한 줄로 설명한다.
 *
 * 예전엔 적립 건을 무조건 '스탬프 적립'으로 적었다. 포인트 매장에서도 그렇게
 * 나와 이미 어긋나 있었는데, 금액 비례 적립이 생기면서 더 곤란해졌다 —
 * `note`에 "12,000원 결제 · 240원 적립"처럼 근거가 되는 금액이 담기는데
 * 그걸 버리고 고정 문구를 쓰면, 정작 사장님이 확인하고 싶은 값이 안 보인다.
 *
 * 그래서 note가 있으면 note를 쓴다. note가 비는 것은 옛 스탬프 적립 로그뿐이라
 * 폴백은 mode로 가른다.
 */
export const logSummary = (log: Log): string => {
  const note = log.note?.trim();
  if (note) return note;
  if (log.action === 'stamp_used') return '사용';
  return log.mode === 'point' ? '포인트 적립' : '스탬프 적립';
};

export type LogActionStyle = {
  /** '적립' | '사용' */
  label: string;
  bg: string;
  fg: string;
};

/**
 * pill 색 체계 — 사용=블루 / 적립=주황 (적립하기 버튼 주황과 한 세트).
 * 기존 green(적립)은 폐기.
 */
export const logActionStyle = (
  action: string,
  theme: Theme,
): LogActionStyle => {
  const isEarn = action === 'stamp_saved';
  return isEarn
    ? {
        label: '적립',
        bg: theme.palette.orange[100],
        fg: theme.palette.orange[400],
      }
    : {
        label: '사용',
        bg: theme.palette.blue[100],
        fg: theme.color.texticon.onNormal.primary,
      };
};
