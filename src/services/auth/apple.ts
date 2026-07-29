import {Platform} from 'react-native';
import appleAuth, {
  AppleRequestResponse,
} from '@invertase/react-native-apple-authentication';

/**
 * Sign in with Apple 래퍼.
 *
 * 구글(google.ts)과 동일한 패턴: 로그인 결과를 값으로 돌려주고
 * 세션 유지는 AuthContext가 담당한다. 반환 형태도 GoogleAccount와 맞춰서
 * LoginScreen이 두 계정을 동일하게 다룰 수 있게 한다.
 *
 * 애플의 두 가지 함정:
 *  1) email·fullName은 "최초 1회" 로그인에서만 내려온다. 두 번째부터는 null.
 *     → email은 identityToken(JWT)의 email 클레임에서 항상 복원한다.
 *  2) user(고유 식별자)는 항상 안정적으로 내려오므로 owners/{uid}의 uid로 쓴다.
 *
 * iOS 전용. (안드로이드는 별도 웹 플로우가 필요하므로 버튼 자체를 노출하지 않는다.)
 */

/** 앱에서 다루는 정규화된 애플 계정 정보 (GoogleAccount와 동일한 형태) */
export type AppleAccount = {
  /** 애플 계정 고유 id — owners/{uid}의 uid로 사용 */
  uid: string;
  email: string;
  name?: string;
  photoUrl?: string;
  idToken?: string;
};

/* eslint-disable no-bitwise -- base64 디코딩은 비트 연산이 본질적으로 필요 */
/** base64url 문자열 디코드 (RN에 atob이 없어 직접 구현) */
const decodeBase64Url = (input: string): string => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const str = base64.replace(/[=]+$/, '');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    buffer = (buffer << 6) | chars.indexOf(str[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
};

/** identityToken(JWT)의 payload에서 email 클레임을 추출한다. 실패 시 undefined. */
const emailFromIdentityToken = (idToken?: string | null): string | undefined => {
  if (!idToken) return undefined;
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return undefined;
    const json = decodeBase64Url(payload);
    const claims = JSON.parse(json) as {email?: string};
    return claims.email;
  } catch {
    return undefined;
  }
};

const fullName = (name?: AppleRequestResponse['fullName']): string | undefined => {
  if (!name) return undefined;
  const parts = [name.givenName, name.familyName].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
};

/** 이 기기에서 Sign in with Apple을 지원하는지 (iOS 13+). */
export const isAppleSignInSupported = (): boolean =>
  Platform.OS === 'ios' && appleAuth.isSupported;

/** 애플 로그인. 취소 시 null, 성공 시 계정 정보 반환. 그 외 에러는 throw. */
export const signInWithApple = async (): Promise<AppleAccount | null> => {
  if (!isAppleSignInSupported()) {
    throw new Error('이 기기에서는 Apple 로그인을 사용할 수 없습니다.');
  }
  try {
    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    });

    if (!response.user) {
      throw new Error('애플 계정 정보를 받지 못했습니다.');
    }

    // 자격 상태 확인 — 유효(AUTHORIZED)해야 로그인 성립
    const credentialState = await appleAuth.getCredentialStateForUser(
      response.user,
    );
    if (credentialState !== appleAuth.State.AUTHORIZED) {
      throw new Error('애플 자격 증명이 유효하지 않습니다.');
    }

    const email =
      response.email ?? emailFromIdentityToken(response.identityToken) ?? '';

    return {
      uid: response.user,
      email,
      name: fullName(response.fullName),
      idToken: response.identityToken ?? undefined,
    };
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as {code: string}).code)
        : '';
    // 사용자가 시트를 닫음
    if (code === appleAuth.Error.CANCELED) return null;
    throw error;
  }
};
