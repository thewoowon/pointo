/**
 * 제공자를 가로지르는 세션 조작.
 *
 * 로그아웃은 화면 3곳(스위처·계정설정·탈퇴유예)에서 일어나는데, 각자
 * "구글 토큰 정리 + Firebase 세션 종료"를 따로 기억하게 두면 언젠가 한 곳이
 * 빠진다. 빠지면 로그아웃했는데 Firestore 권한은 살아있는 상태가 되므로
 * 한 함수로 묶는다.
 */

import {signOutGoogle} from './google';
import {ensureAnonymousSession, signOutFirebase} from './firebase';

/**
 * 점주 로그아웃. 소셜 토큰과 Firebase 세션을 함께 정리한다.
 *
 * @param keepAnonymous 로그아웃 후에도 이 기기를 고객 모드로 계속 쓸 경우 true.
 *   익명 세션을 다시 깔아 고객 화면의 Firestore 접근을 유지한다.
 */
export async function signOutOwner(keepAnonymous = false): Promise<void> {
  // 애플은 별도 세션 해제 API가 없다 — Firebase 세션 종료로 충분하다.
  await signOutGoogle();
  await signOutFirebase();
  if (keepAnonymous) {
    await ensureAnonymousSession();
  }
}
