/**
 * 구매금액 기반 포인트 적립 계산.
 *
 * 포인트 모드 매장이 "12,000원의 2%"처럼 결제 금액에서 바로 적립액을 얻고 싶다는
 * 요청에서 나왔다. 계산을 화면에 박지 않고 여기 두는 이유는 두 가지다 —
 * 미리보기(입력 중)와 실제 적립(저장 직전)이 **반드시 같은 값**을 내야 하고,
 * 나중에 결제 이벤트가 다른 경로로 들어와도 이 함수 하나만 통과시키면 되기 때문.
 */

/** 적립률 상한 = 100.00%. basis point 단위. */
export const MAX_RATE_BPS = 10_000;

/** 한 건에 입력 가능한 최대 결제 금액. 오타(0 하나 더)를 막는 현실적인 상한. */
export const MAX_PURCHASE_AMOUNT = 10_000_000;

/**
 * 적립률을 basis point 정수로 저장하는 이유:
 * `2.5%`를 0.025로 들고 있으면 곱셈에서 부동소수 오차가 난다. 250으로 두면
 * 계산이 정수 곱/나눗셈으로 끝나 표시값과 저장값이 어긋날 일이 없다.
 */
export const pctToBps = (pct: number): number => Math.round(pct * 100);

/** 저장된 bps를 사람이 읽는 % 문자열로. 200 → "2", 250 → "2.5" */
export const bpsToPctLabel = (bps: number): string => {
  const pct = bps / 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
};

/**
 * 구매금액 × 적립률 → 적립 포인트.
 *
 * 버림(floor)이다. 올림이면 100원짜리에 1원씩 새어 나가고, 무엇보다 사장님에게
 * 설명하기 어렵다 — "2%면 딱 2%"가 되는 쪽을 택했다.
 *
 * 입력이 조금이라도 이상하면 0을 돌려준다. 호출부는 0을 "적립할 게 없음"으로
 * 취급해 버튼을 막는다. 여기서 throw하면 키패드를 누르는 도중에 터진다.
 */
export const calcPointsFromAmount = (
  amountKrw: number,
  rateBps: number,
): number => {
  if (!Number.isInteger(amountKrw) || amountKrw <= 0) return 0;
  if (amountKrw > MAX_PURCHASE_AMOUNT) return 0;
  if (!Number.isInteger(rateBps) || rateBps <= 0 || rateBps > MAX_RATE_BPS) {
    return 0;
  }
  return Math.floor((amountKrw * rateBps) / MAX_RATE_BPS);
};

/** 설정 화면에서 받은 적립률 문자열이 저장 가능한 값인지. */
export const validateRatePct = (
  raw: string,
): {ok: true; bps: number} | {ok: false; message: string} => {
  const pct = parseFloat(raw);
  if (isNaN(pct)) {
    return {ok: false, message: '적립률을 숫자로 입력해주세요.'};
  }
  if (pct <= 0) {
    return {ok: false, message: '적립률은 0보다 커야 합니다.'};
  }
  if (pct > 100) {
    return {ok: false, message: '적립률은 100%를 넘을 수 없습니다.'};
  }
  const bps = pctToBps(pct);
  // 0.01% 미만은 bps로 내려오면서 0이 된다 — 저장은 되는데 한 푼도 안 쌓인다.
  if (bps <= 0) {
    return {ok: false, message: '적립률은 0.01% 이상이어야 합니다.'};
  }
  return {ok: true, bps};
};
