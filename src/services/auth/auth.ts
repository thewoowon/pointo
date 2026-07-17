import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';

export type AuthUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

function toAuthUser(u: FirebaseAuthTypes.User): AuthUser {
  return {uid: u.uid, email: u.email, emailVerified: u.emailVerified};
}

/** 이메일 회원가입 + 인증메일 발송 (메일 발송 실패는 가입을 막지 않음) */
export const signUpWithEmail = async (
  email: string,
  password: string,
): Promise<AuthUser> => {
  const auth = getAuth();
  const cred = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  try {
    await sendEmailVerification(cred.user);
  } catch (error) {
    console.warn('인증메일 발송 실패:', error);
  }
  return toAuthUser(cred.user);
};

/** 이메일 로그인 */
export const signInWithEmail = async (
  email: string,
  password: string,
): Promise<AuthUser> => {
  const auth = getAuth();
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return toAuthUser(cred.user);
};

/** 로그아웃 (Firebase Auth 세션 해제) */
export const signOutOwner = async (): Promise<void> => {
  const auth = getAuth();
  await fbSignOut(auth);
};

/** 현재 로그인된 점주 (없으면 null) */
export const getCurrentOwner = (): AuthUser | null => {
  const auth = getAuth();
  return auth.currentUser ? toAuthUser(auth.currentUser) : null;
};

/** 서버에서 최신 상태 새로고침 — 인증메일 클릭 후 emailVerified 갱신 확인용 */
export const reloadCurrentOwner = async (): Promise<AuthUser | null> => {
  const auth = getAuth();
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  return auth.currentUser ? toAuthUser(auth.currentUser) : null;
};

/** 인증메일 재발송 */
export const resendVerificationEmail = async (): Promise<void> => {
  const auth = getAuth();
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
};

/** 비밀번호 재설정 메일 발송 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  const auth = getAuth();
  await sendPasswordResetEmail(auth, email.trim());
};

/** Firebase Auth 에러 코드를 사용자용 한국어 메시지로 변환 */
export const authErrorMessage = (error: unknown): string => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as {code: string}).code)
      : '';
  switch (code) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.';
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다. 로그인해주세요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/too-many-requests':
      return '시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해주세요.';
    default:
      return '오류가 발생했습니다. 다시 시도해주세요.';
  }
};
