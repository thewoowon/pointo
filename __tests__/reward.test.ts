import {
  calcPointsFromAmount,
  pctToBps,
  bpsToPctLabel,
  validateRatePct,
  MAX_PURCHASE_AMOUNT,
} from '../src/utils/reward';

describe('calcPointsFromAmount', () => {
  // 사장님이 실제로 든 예시가 첫 줄이다 — 이 값이 틀리면 기능의 존재 이유가 없다.
  it.each([
    [12_000, 200, 240], // 12,000원의 2%
    [10_000, 100, 100],
    [999, 100, 9], // 9.99 → 버림
    [100, 50, 0], // 0.5 → 버림해서 0
    [100_000, 350, 3_500],
  ])('%i원 @ %ibps = %iP', (amount, bps, expected) => {
    expect(calcPointsFromAmount(amount, bps)).toBe(expected);
  });

  it('100%면 금액이 그대로 적립된다', () => {
    expect(calcPointsFromAmount(12_000, 10_000)).toBe(12_000);
  });

  it('0.01%(1bps)도 계산된다', () => {
    expect(calcPointsFromAmount(1_000_000, 1)).toBe(100);
  });

  describe('막아야 하는 입력', () => {
    it.each([
      ['금액 0', 0, 200],
      ['음수 금액', -12_000, 200],
      ['소수 금액', 12_000.5, 200],
      ['상한 초과 금액', MAX_PURCHASE_AMOUNT + 1, 200],
      ['적립률 0', 12_000, 0],
      ['음수 적립률', 12_000, -200],
      ['100% 초과 적립률', 12_000, 10_001],
      ['소수 적립률(bps는 정수여야)', 12_000, 200.5],
      ['NaN 금액', NaN, 200],
      ['NaN 적립률', 12_000, NaN],
    ])('%s → 0', (_label, amount, bps) => {
      expect(calcPointsFromAmount(amount, bps)).toBe(0);
    });
  });

  it('큰 금액에서도 정수를 유지한다', () => {
    const points = calcPointsFromAmount(MAX_PURCHASE_AMOUNT, 350);
    expect(points).toBe(350_000);
    expect(Number.isSafeInteger(points)).toBe(true);
  });
});

describe('pctToBps / bpsToPctLabel', () => {
  it.each([
    [2, 200],
    [2.5, 250],
    [0.5, 50],
    [100, 10_000],
    [0.01, 1],
  ])('%s%% → %ibps', (pct, bps) => {
    expect(pctToBps(pct)).toBe(bps);
  });

  it('부동소수 오차 없이 왕복한다', () => {
    // 2.9 * 100 = 289.99999999999994 — round가 없으면 289bps로 저장된다
    expect(pctToBps(2.9)).toBe(290);
    expect(bpsToPctLabel(290)).toBe('2.9');
  });

  it.each([
    [200, '2'],
    [250, '2.5'],
    [10_000, '100'],
  ])('%ibps → "%s"', (bps, label) => {
    expect(bpsToPctLabel(bps)).toBe(label);
  });
});

describe('validateRatePct', () => {
  it('정상값은 bps를 돌려준다', () => {
    expect(validateRatePct('2')).toEqual({ok: true, bps: 200});
    expect(validateRatePct('2.5')).toEqual({ok: true, bps: 250});
  });

  it.each(['', 'abc', '0', '-1', '101', '0.001'])(
    '"%s"는 거절한다',
    raw => {
      expect(validateRatePct(raw).ok).toBe(false);
    },
  );
});
