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
