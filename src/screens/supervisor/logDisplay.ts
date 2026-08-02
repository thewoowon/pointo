import type {Theme} from '../../theme';

// 적립내역 화면 공용 표시 규칙 (마스킹 + pill 색). MainScreen·바텀시트·상세뷰가 공유.

/** 리스트 행에 쓰는 뒤 4자리. 예) 01012345678 → '5678' */
export const phoneLast4 = (phone: string): string =>
  (phone || '').replace(/\D/g, '').slice(-4);

/** 상세/시트용 마스킹 표기. 예) 01012345678 → '010 **** 5678' */
export const maskPhone = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 7) return digits;
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head} **** ${tail}`;
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
        fg: theme.palette.orange[600],
      }
    : {
        label: '사용',
        bg: theme.palette.blue[50],
        fg: theme.color.texticon.onNormal.primary,
      };
};
