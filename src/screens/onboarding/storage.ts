import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 온보딩 노출 슬롯.
 *
 *  intro  — 로그인 전 최초 1회. "포인토가 뭔지"를 잡아준다.
 *  setup  — 첫 매장 등록 직후 1회. 이때가 "기기 2대" 개념이 실제로 필요해지는
 *           순간이다. 자연유입 점주가 매장만 만들고 첫 적립 없이 이탈하는 게
 *           지금의 문제라, intro만으로는 닿지 않는다.
 *  replay — 설정에서 다시보기. 노출 기록을 남기지 않는다.
 */
export type OnboardingSlot = 'intro' | 'setup' | 'replay';

const KEYS: Record<OnboardingSlot, string | null> = {
  intro: '@pointo_onboarding_intro_seen',
  setup: '@pointo_onboarding_setup_seen',
  replay: null,
};

/**
 * 이미 본 슬롯인지. 저장소 오류 시 `true`(=안 보여준다)로 실패한다 —
 * 읽기가 깨졌을 때 매 실행마다 온보딩이 다시 뜨는 쪽이 훨씬 나쁘다.
 */
export const hasSeenOnboarding = async (
  slot: OnboardingSlot,
): Promise<boolean> => {
  const key = KEYS[slot];
  if (!key) return true;
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return true;
  }
};

export const markOnboardingSeen = async (slot: OnboardingSlot) => {
  const key = KEYS[slot];
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, '1');
  } catch {}
};

const FIRST_GIVE_KEY = '@pointo_first_give_done';

/**
 * 이 기기의 점주가 첫 적립을 마쳤는지 (로컬 캐시).
 *
 * 한 번 참이 되면 다시 뒤집히지 않는 사실이라 기기에 적어둔다 — 스위처가
 * 포커스될 때마다 매장 수만큼 Firestore를 두드리는 걸 막는다. 판정의 근거는
 * 어디까지나 서버(`hasAnyLog`)이고, 여기 있는 건 그 결과를 재사용하는 캐시다.
 * 캐시가 비어 있으면 그냥 서버에 다시 물어보면 되므로 실패는 무해하다.
 */
export const hasDoneFirstGive = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(FIRST_GIVE_KEY)) === '1';
  } catch {
    return false;
  }
};

export const markFirstGiveDone = async () => {
  try {
    await AsyncStorage.setItem(FIRST_GIVE_KEY, '1');
  } catch {}
};
