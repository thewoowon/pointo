import {Platform} from 'react-native';
import GoogleAuthModule from '@thewoowon/google-rn';
import {GOOGLE_IOS_CLIENT_ID, GOOGLE_AOS_CLIENT_ID} from '@env';

/**
 * @thewoowon/google-rn 래퍼.
 *
 * useGoogleAuth 훅 대신 네이티브 모듈을 직접 쓴다. 훅의 signIn은 void라
 * 로그인 결과를 React state(user)로만 흘리는데, 우리 네비 흐름은
 * "로그인 → account 받아서 곧바로 프로필 보장 + 화면 이동"이라 결과를
 * 값으로 돌려받는 편이 훨씬 깔끔하기 때문. 세션 유지는 AuthContext가 담당한다.
 */

/** 네이티브 signIn()이 돌려주는 평면 결과 형태 */
type NativeSignInResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  idToken?: string;
  tokenType?: string;
  user: {
    id: string;
    email: string;
    emailVerified?: boolean;
    name?: string;
    photoUrl?: string;
  };
};

/** 앱에서 다루는 정규화된 구글 계정 정보 */
export type GoogleAccount = {
  /** 구글 계정 고유 id — owners/{uid}의 uid로 사용 */
  uid: string;
  email: string;
  name?: string;
  photoUrl?: string;
  idToken?: string;
};

const clientId =
  Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_AOS_CLIENT_ID;

let configured = false;

/** 앱 시작 시 1회 호출. signIn 전에 반드시 선행되어야 한다. (redirectUri·PKCE는 네이티브 기본값) */
export const configureGoogle = async (): Promise<void> => {
  if (configured) return;
  if (!clientId) {
    console.warn('[google] GOOGLE_CLIENT_ID가 비어있습니다. env 확인 필요.');
    return;
  }
  await GoogleAuthModule.configure({
    clientId,
    scopes: ['openid', 'profile', 'email'],
  });
  configured = true;
};

/** 구글 로그인. 취소 시 null, 성공 시 계정 정보 반환. 그 외 에러는 throw. */
export const signInWithGoogle = async (): Promise<GoogleAccount | null> => {
  await configureGoogle();
  try {
    const result = (await GoogleAuthModule.signIn()) as NativeSignInResult;
    if (!result?.user?.id) {
      throw new Error('구글 계정 정보를 받지 못했습니다.');
    }
    return {
      uid: result.user.id,
      email: result.user.email,
      name: result.user.name,
      photoUrl: result.user.photoUrl,
      idToken: result.idToken,
    };
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as {code: string}).code)
        : '';
    if (code === 'CANCELLED') return null;
    throw error;
  }
};

/** 구글 세션 해제 (저장된 토큰 삭제) */
export const signOutGoogle = async (): Promise<void> => {
  try {
    await GoogleAuthModule.signOut();
  } catch (error) {
    console.warn('[google] signOut 실패:', error);
  }
};
