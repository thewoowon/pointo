/**
 * 의견 보내기.
 *
 * 점주가 막히는 지점은 화면 로그로는 안 보인다 — "찾으시는 기능이 없으신가요?"에
 * 답이 돌아와야 다음에 뭘 만들지 알 수 있다. 그래서 문의 채널을 앱 밖(이메일·
 * 카카오)에 두지 않고 홈에서 두 번 터치로 닿는 자리에 둔다.
 *
 * 쓰기 전용 컬렉션이다. 남의 의견을 읽을 이유가 없고 내용에 매장 사정이 그대로
 * 담기므로, 조회는 규칙에서 전면 차단하고 콘솔/Admin SDK로만 본다.
 */

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

/** 본문 최대 길이. firestore.rules의 상한과 같은 값이어야 한다. */
export const OPINION_MAX_LENGTH = 2000;

export type OpinionDraft = {
  text: string;
  email: string | null;
  provider: 'google' | 'apple' | null;
};

/**
 * 의견 한 건을 남긴다. 성공 여부만 돌려준다 — 화면은 재시도를 안내하는 것
 * 말고는 실패에 대해 할 수 있는 게 없다.
 *
 * `ownerUid`는 컨텍스트의 값이 아니라 Firebase 세션에서 직접 읽는다. 규칙이
 * `request.auth.uid`와 대조하는 값이 이쪽이고, 레거시 기기의 컨텍스트에는 아직
 * 제공자 id가 들어있을 수 있다.
 */
export const submitOpinion = async (draft: OpinionDraft): Promise<boolean> => {
  const text = draft.text.trim();
  if (!text) return false;

  const uid = getFirebaseUid();
  if (!uid) return false;

  try {
    const db = getFirestore();
    await setDoc(doc(collection(db, 'feedback')), {
      text: text.slice(0, OPINION_MAX_LENGTH),
      ownerUid: uid,
      ownerEmail: draft.email ?? null,
      ownerProvider: draft.provider ?? null,
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      appVersion: APP_VERSION,
      createdAt: serverTimestamp(),
      // 읽은 의견을 골라내기 위한 상태. 콘솔에서 손으로 바꾼다.
      status: 'new',
    });
    return true;
  } catch (error) {
    console.error('Error submitting opinion:', error);
    return false;
  }
};
