/**
 * Firebase Auth 브리지.
 *
 * 왜 필요한가: 이 앱은 그동안 구글/애플 네이티브 SDK로만 로그인하고 Firebase Auth
 * 세션은 만들지 않았다. 그래서 Firestore 보안 규칙에서 `request.auth`가 항상 null이었고,
 * 규칙을 `allow read, write: if true`로 열어둘 수밖에 없었다. 소셜 로그인 결과를
 * Firebase 자격증명으로 교환해 진짜 세션을 만들면 규칙에서 소유권을 검증할 수 있다.
 *
 * uid 주의: 여기서 나오는 uid는 **Firebase uid**로, 기존에 쓰던 구글/애플 제공자 id와
 * 다른 값이다. 기존 `owners/{제공자id}` 문서는 마이그레이션이 필요하다.
 * (useFirestore.migrateLegacyOwner 참고)
 */

import {
  AppleAuthProvider,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signOut,
} from '@react-native-firebase/auth';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';

/** 현재 Firebase 세션의 uid. 로그인 전이면 null. */
export const getFirebaseUid = (): string | null =>
  getAuth().currentUser?.uid ?? null;

/** 현재 세션이 익명(키오스크) 세션인지 */
export const isAnonymousSession = (): boolean =>
  getAuth().currentUser?.isAnonymous === true;

/**
 * Firebase가 저장된 세션을 복원할 때까지 기다린다.
 *
 * currentUser는 앱 시작 직후 잠깐 null이다. 이걸 안 기다리고 Firestore를 호출하면
 * 규칙이 무인증으로 판정해 첫 요청이 permission-denied로 떨어진다.
 * AuthContext 초기화에서 반드시 await 할 것.
 */
export function waitForAuthReady(): Promise<FirebaseAuthTypes.User | null> {
  return new Promise(resolve => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(
      auth,
      (user: FirebaseAuthTypes.User | null) => {
        unsubscribe();
        resolve(user);
      },
    );
  });
}

/** 구글 idToken → Firebase 세션. Firebase uid 반환. */
export async function signInFirebaseWithGoogle(
  idToken: string,
): Promise<string> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(getAuth(), credential);
  return result.user.uid;
}

/**
 * 애플 identityToken + raw nonce → Firebase 세션. Firebase uid 반환.
 * rawNonce는 애플에 보낼 때 SHA-256으로 해시한 그 값의 **원본**이어야 한다.
 */
export async function signInFirebaseWithApple(
  identityToken: string,
  rawNonce: string,
): Promise<string> {
  const credential = AppleAuthProvider.credential(identityToken, rawNonce);
  const result = await signInWithCredential(getAuth(), credential);
  return result.user.uid;
}

/**
 * 고객(키오스크) 기기용 익명 세션 보장.
 *
 * 익명 세션은 누구나 발급받을 수 있어 "신원 증명"은 못 한다. 목적은 규칙에서
 * 무인증 트래픽을 걸러내고, 익명에게는 단건 조회만 허용하고 컬렉션 전체 열거
 * (전화번호 대량 유출 경로)를 차단하는 것이다. 위조 방지는 App Check 단계에서 다룬다.
 *
 * 이미 점주 세션이 있으면 그대로 둔다 — 점주 권한이 더 넓기 때문.
 */
export async function ensureAnonymousSession(): Promise<string | null> {
  const auth = getAuth();
  if (auth.currentUser) return auth.currentUser.uid;
  try {
    const result = await signInAnonymously(auth);
    return result.user.uid;
  } catch (error) {
    console.error('[firebase-auth] 익명 로그인 실패:', error);
    return null;
  }
}

/**
 * Firebase 세션 종료.
 *
 * 로그아웃 후에도 이 기기가 고객 모드로 계속 쓰일 수 있으므로,
 * 호출부에서 필요하면 ensureAnonymousSession()으로 익명 세션을 다시 깐다.
 */
export async function signOutFirebase(): Promise<void> {
  try {
    await signOut(getAuth());
  } catch (error) {
    console.warn('[firebase-auth] 로그아웃 실패:', error);
  }
}

/** 서버 호출용 ID 토큰. 세션이 없으면 null. */
export async function getIdTokenForServer(): Promise<string | null> {
  const user = getAuth().currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    console.warn('[firebase-auth] ID 토큰 발급 실패:', error);
    return null;
  }
}
