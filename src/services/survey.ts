/**
 * 인앱 설문.
 *
 * 왜 앱 안에 두는가. 지금까지 설문은 점주에게 문자로 구글 폼 링크를 보내는
 * 방식이었는데, 두 가지가 어긋났다 — 링크를 누르는 사람이 거의 없었고(회수
 * 2건), 그중 한 명은 폼 대신 문자로 답을 적어 보내서 응답이 폼 밖에 남았다.
 * 즉 채널이 점주의 동선에 없었다.
 *
 * 그래서 이미 쓰고 있는 화면에서, 이미 있는 경로(feedback 컬렉션 → 메일 알림)로
 * 받는다. 별도 수집처를 만들지 않는 게 핵심이다. 폼처럼 응답이 어딘가에
 * 고여 있다가 분실되지 않고, 도착 즉시 메일로 올라온다.
 *
 * 질문은 넷을 넘기지 않는다. 다섯 번째 질문의 가치보다 이탈이 크다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import {getFirebaseUid} from './auth';
import {APP_VERSION} from '../constants';
import {OPINION_MAX_LENGTH} from './feedback';

/**
 * 설문 판 번호. 질문을 바꾸면 반드시 올린다 — 이미 응답한 점주에게 새 설문을
 * 다시 물을 수 있어야 하고, 응답끼리 섞이면 안 된다.
 */
export const SURVEY_ID = 'v1';

/** 노출까지 기다리는 기간. 가입 당일에 물으면 답할 경험이 없다. */
export const SURVEY_MIN_AGE_DAYS = 3;
/** '나중에'를 누른 뒤 다시 묻기까지. */
export const SURVEY_SNOOZE_DAYS = 7;

export type SurveyQuestion = {
  id: string;
  /** 점주에게 보이는 질문 */
  title: string;
  /** 보기. 마지막 항목에 자유 입력이 필요하면 `withText` */
  options?: {value: string; label: string; withText?: boolean}[];
  /** 보기 없이 자유 입력만 받는 질문 */
  freeText?: boolean;
  placeholder?: string;
  /** 비워두고 넘어갈 수 있는가 */
  optional?: boolean;
};

/**
 * 질문 순서에 의도가 있다.
 *
 * 1번(유입 경로)이 먼저인 이유: 지금까지 회수된 단 한 건에서 가장 값이 컸던
 * 정보가 "네이버에 '포인트 적립'이라고 검색해서 왔다"였다. 광고 없이 확인된
 * 유일한 유입 채널이라, 이걸 여러 건 모으는 것만으로 마케팅 판단이 선다.
 *
 * 2번(사용 실태)은 이탈을 잡기 위한 질문이다. 매장만 만들고 한 번도 적립하지
 * 않은 채 떠나는 흐름이 있는데, 그 사람들은 의견 보내기를 쓰지 않는다.
 * 보기에 '아직 안 써봤다'를 명시적으로 두어 답하기 부끄럽지 않게 한다.
 */
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'acquisition',
    title: '포인토를 어떻게 알게 되셨나요?',
    options: [
      {value: 'search', label: '검색하다가', withText: true},
      {value: 'recommend', label: '주변 추천'},
      {value: 'ad', label: '광고를 보고'},
      {value: 'etc', label: '그 외', withText: true},
    ],
  },
  {
    id: 'usage',
    title: '지금 매장에서 쓰고 계신가요?',
    options: [
      {value: 'daily', label: '거의 매일 쓰고 있어요'},
      {value: 'sometimes', label: '가끔 써요'},
      {value: 'not_yet', label: '설치만 하고 아직 못 써봤어요'},
      {value: 'stopped', label: '쓰다가 그만뒀어요'},
    ],
  },
  {
    id: 'friction',
    title: '가장 아쉬웠던 점은 무엇인가요?',
    freeText: true,
    placeholder: '불편한 점, 없어서 아쉬운 기능 무엇이든 좋아요.',
  },
  {
    id: 'pos',
    title: '매장에서 쓰시는 POS나 단말기가 있나요?',
    optional: true,
    options: [
      {value: 'has_pos', label: '있어요', withText: true},
      {value: 'no_pos', label: '없어요'},
    ],
  },
];

export type SurveyAnswer = {
  /** 고른 보기의 value. 자유 입력만 있는 질문이면 없음 */
  value?: string;
  /** 보기에 딸린 자유 입력 또는 자유 입력 질문의 본문 */
  text?: string;
};

export type SurveyAnswers = Record<string, SurveyAnswer>;

/**
 * 응답을 사람이 읽는 한 덩어리로 만든다.
 *
 * 구조화된 필드를 따로 싣긴 하지만, 실제로 우리가 읽는 것은 도착 메일 본문이다.
 * 그 메일은 `text` 하나만 보고 만들어지므로 여기서 다 담아야 한다.
 */
export const formatSurveyText = (answers: SurveyAnswers): string => {
  const lines: string[] = [`[이용 설문 ${SURVEY_ID}]`, ''];

  for (const q of SURVEY_QUESTIONS) {
    const a = answers[q.id];
    if (!a) continue;

    const label = q.options?.find(o => o.value === a.value)?.label;
    const parts = [label, a.text?.trim()].filter(Boolean);
    if (parts.length === 0) continue;

    lines.push(`Q. ${q.title}`);
    lines.push(`A. ${parts.join(' — ')}`);
    lines.push('');
  }

  return lines.join('\n').trim();
};

/** 최소 한 문항은 답해야 보낼 수 있다. */
export const hasAnyAnswer = (answers: SurveyAnswers): boolean =>
  SURVEY_QUESTIONS.some(q => {
    const a = answers[q.id];
    return Boolean(a?.value || a?.text?.trim());
  });

/**
 * 설문 한 건을 남긴다.
 *
 * 의견과 같은 컬렉션에 쓴다. 규칙이 보는 것은 `ownerUid`와 `text`뿐이라
 * 규칙 변경이 필요 없고, 도착 알림 메일도 그대로 동작한다. `kind`로 갈라
 * 나중에 의견과 설문을 구분해 읽을 수 있게만 해둔다.
 */
export const submitSurvey = async (
  answers: SurveyAnswers,
  meta: {email: string | null; provider: 'google' | 'apple' | null},
): Promise<boolean> => {
  const text = formatSurveyText(answers);
  if (!text) return false;

  const uid = getFirebaseUid();
  if (!uid) return false;

  try {
    const db = getFirestore();
    await setDoc(doc(collection(db, 'feedback')), {
      kind: 'survey',
      surveyId: SURVEY_ID,
      // 사람이 읽는 본문. 규칙과 알림 메일이 보는 필드다.
      text: text.slice(0, OPINION_MAX_LENGTH),
      // 집계용 원본. 자유 입력은 text에 이미 들어 있어 값만 담는다.
      answers: Object.fromEntries(
        SURVEY_QUESTIONS.map(q => [q.id, answers[q.id]?.value ?? null]),
      ),
      ownerUid: uid,
      ownerEmail: meta.email ?? null,
      ownerProvider: meta.provider ?? null,
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      appVersion: APP_VERSION,
      createdAt: serverTimestamp(),
      status: 'new',
    });
    return true;
  } catch (error) {
    console.error('Error submitting survey:', error);
    return false;
  }
};

// ─── 노출 여부 (기기 로컬) ──────────────────────────────────────────────
//
// 서버에 두지 않는 이유: 이건 "이 기기에서 이미 물어봤는가"라는 표시일 뿐이고,
// 틀려도 손해가 설문을 한 번 더 보는 정도다. 서버에 두면 읽기 규칙을 열어야
// 하는데, feedback은 조회를 전면 차단해둔 컬렉션이라 그 문을 여는 값이 없다.

const doneKey = (uid: string) => `survey:${SURVEY_ID}:done:${uid}`;
const snoozeKey = (uid: string) => `survey:${SURVEY_ID}:snooze:${uid}`;

export const markSurveyDone = async (uid: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(doneKey(uid), new Date().toISOString());
  } catch {
    // 저장에 실패하면 다음에 한 번 더 보일 뿐이다. 흐름을 막지 않는다.
  }
};

export const snoozeSurvey = async (uid: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(snoozeKey(uid), new Date().toISOString());
  } catch {
    // 위와 같음
  }
};

const daysSince = (iso: string | null): number | null => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  return (Date.now() - then) / 86_400_000;
};

/**
 * 지금 이 점주에게 설문을 권해도 되는가.
 *
 * `ownerCreatedAt`이 없으면(레거시 계정) 나이 조건은 통과시킨다 — 오래 쓴
 * 계정일 가능성이 높고, 정작 물어봐야 할 사람을 나이를 몰라서 빠뜨리면 안 된다.
 */
export const shouldAskSurvey = async (
  uid: string | null,
  ownerCreatedAt?: string | null,
): Promise<boolean> => {
  if (!uid) return false;

  const age = daysSince(ownerCreatedAt ?? null);
  if (age !== null && age < SURVEY_MIN_AGE_DAYS) return false;

  try {
    const done = await AsyncStorage.getItem(doneKey(uid));
    if (done) return false;

    const snoozed = daysSince(await AsyncStorage.getItem(snoozeKey(uid)));
    if (snoozed !== null && snoozed < SURVEY_SNOOZE_DAYS) return false;

    return true;
  } catch {
    // 읽기에 실패했으면 묻지 않는다. 이미 답한 사람에게 또 묻는 쪽이 더 나쁘다.
    return false;
  }
};
