/**
 * 앱 재시작 시 로그인이 복원되는지 검증한다.
 *
 * 이 경로는 손으로 확인하기가 유독 번거롭다 — 구글/애플 로그인을 실제로 통과한
 * 뒤 앱을 죽였다 켜야 재현되기 때문이다. 그래서 AsyncStorage와 Firebase Auth를
 * 갈아끼우고 AuthProvider만 띄워서 initializeAuth의 판단을 직접 본다.
 *
 * 지키려는 규칙:
 *   1. Firebase 세션이 살아 있으면 매장에 안 들어가 있어도 로그인 상태를 잇는다
 *      (= 매장에서 나온 뒤 껐다 켰다고 다시 로그인시키지 않는다)
 *   2. 익명 세션(고객 전용 기기)은 점주로 취급하지 않는다
 *   3. 로그아웃한 기기는 로그인 화면으로 보낸다
 *
 * mock 접두사는 취향이 아니라 규칙이다 — jest.mock 팩토리는 호이스팅돼서
 * `mock`으로 시작하는 이름만 바깥에서 끌어다 쓸 수 있다.
 */

import React from 'react';
import renderer, {act} from 'react-test-renderer';
// 이 프로젝트엔 @types/jest가 없다 — App.test.tsx와 같이 명시적으로 가져온다.
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';

// ─── AsyncStorage: 메모리 스텁 ──────────────────────────────────
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mockStore[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete mockStore[k];
    }),
  },
}));

// ─── Firebase Auth: 현재 세션을 테스트가 정한다 ──────────────────
let mockCurrentUser: any = null;
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({
    get currentUser() {
      return mockCurrentUser;
    },
  }),
  // 네이티브 SDK처럼 동기가 아니라 다음 틱에 현재 상태를 흘려준다.
  // setTimeout이 아니라 마이크로태스크인 이유: act()가 확정적으로 flush해 준다.
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    Promise.resolve().then(() => cb(mockCurrentUser));
    return () => {};
  },
  signInAnonymously: jest.fn(async () => {
    mockCurrentUser = {uid: 'anon-uid', isAnonymous: true, providerData: []};
    return {user: mockCurrentUser};
  }),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: {credential: jest.fn()},
  AppleAuthProvider: {credential: jest.fn()},
}));

import {AuthContext, AuthProvider} from '../src/contexts/AuthContext';

const OWNER = {
  uid: 'firebase-uid-1',
  isAnonymous: false,
  email: 'owner@example.com',
  providerData: [{providerId: 'google.com'}],
};

let mounted: ReturnType<typeof renderer.create>[] = [];

/** AuthProvider를 띄우고 초기화가 끝난 시점의 context를 돌려준다. */
async function mountAuth() {
  let ctx: any = null;
  const Probe = () => {
    ctx = React.useContext(AuthContext);
    return null;
  };
  await act(async () => {
    mounted.push(
      renderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      ),
    );
  });
  // initializeAuth가 await를 여러 번 넘기므로 한 번 더 비워준다
  await act(async () => {});
  return () => ctx;
}

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockCurrentUser = null;
});

// 앞 테스트의 Provider가 살아 있으면 그쪽 effect가 저장소를 계속 건드린다
afterEach(() => {
  act(() => {
    mounted.forEach(t => t.unmount());
  });
  mounted = [];
});

describe('앱 재시작 후 로그인 복원', () => {
  it('매장 세션이 없어도 Firebase 세션이 살아 있으면 로그인을 유지한다', async () => {
    // 매장에서 나온 상태로 앱을 껐다 켠 기기 — 저장된 매장 세션이 없다.
    mockCurrentUser = OWNER;
    mockStore['@pointo_owner'] = JSON.stringify({
      uid: OWNER.uid,
      email: OWNER.email,
      provider: 'google',
    });

    const ctx = await mountAuth();

    expect(ctx().ownerUid).toBe(OWNER.uid);
    expect(ctx().ownerEmail).toBe(OWNER.email);
    expect(ctx().ownerProvider).toBe('google');
    // 매장에는 들어가지 않는다 — 스위처('내 매장')에서 고르게 둔다.
    expect(ctx().isAuthenticated).toBe(false);
    expect(ctx().isLoading).toBe(false);
  });

  it('저장된 계정 정보가 없어도 Firebase 세션만으로 복원한다', async () => {
    // 이 버전으로 올라오기 전에 로그인해둔 기기 (@pointo_owner가 아직 없다)
    mockCurrentUser = OWNER;

    const ctx = await mountAuth();

    expect(ctx().ownerUid).toBe(OWNER.uid);
    expect(ctx().ownerProvider).toBe('google');
  });

  it('매장 세션이 있으면 그 매장·모드로 바로 들어간다', async () => {
    mockCurrentUser = OWNER;
    mockStore['@pointo_auth'] = JSON.stringify({
      storeCode: 'IADLDJ',
      storeName: 'test',
      mode: 'supervisor',
    });

    const ctx = await mountAuth();

    expect(ctx().isAuthenticated).toBe(true);
    expect(ctx().storeCode).toBe('IADLDJ');
    expect(ctx().mode).toBe('supervisor');
    expect(ctx().ownerUid).toBe(OWNER.uid);
  });

  it('익명 세션(고객 전용 기기)은 점주로 복원하지 않는다', async () => {
    mockCurrentUser = {uid: 'anon-uid', isAnonymous: true, providerData: []};

    const ctx = await mountAuth();

    expect(ctx().ownerUid).toBeNull();
  });

  it('로그아웃한 기기는 로그인 화면으로 보낸다', async () => {
    mockCurrentUser = null;
    // 로그아웃 전 계정 정보가 남아 있어도 Firebase 세션이 없으면 신뢰하지 않는다.
    mockStore['@pointo_owner'] = JSON.stringify({
      uid: OWNER.uid,
      email: OWNER.email,
      provider: 'google',
    });

    const ctx = await mountAuth();

    expect(ctx().ownerUid).toBeNull();
    expect(ctx().isAuthenticated).toBe(false);
    expect(mockStore['@pointo_owner']).toBeUndefined();
  });

  it('점주 세션이 끊긴 기기의 관리자 매장 세션은 폐기한다', async () => {
    // Firebase Auth 도입 전 버전에서 올라온 기기 — 매장 세션은 있는데 계정이 없다.
    mockCurrentUser = null;
    mockStore['@pointo_auth'] = JSON.stringify({
      storeCode: 'IADLDJ',
      storeName: 'test',
      mode: 'supervisor',
    });

    const ctx = await mountAuth();

    expect(ctx().isAuthenticated).toBe(false);
    expect(mockStore['@pointo_auth']).toBeUndefined();
  });

  it('고객 모드로 잠긴 기기는 계정을 살린 채 고객 화면으로 복귀한다', async () => {
    // PIN을 풀면 곧장 '내 매장'으로 돌아가야 하므로 계정도 함께 복원한다.
    mockCurrentUser = OWNER;
    mockStore['@pointo_device'] = JSON.stringify({
      lockedStoreCode: 'IADLDJ',
      lockedStoreName: 'test',
      pin: '1234',
    });

    const ctx = await mountAuth();

    expect(ctx().mode).toBe('client');
    expect(ctx().isAuthenticated).toBe(true);
    expect(ctx().storeCode).toBe('IADLDJ');
    expect(ctx().ownerUid).toBe(OWNER.uid);
  });
});
