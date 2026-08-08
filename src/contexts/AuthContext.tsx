import React, {createContext, useCallback, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getAuth, onAuthStateChanged} from '@react-native-firebase/auth';
import type {FirebaseAuthTypes} from '@react-native-firebase/auth';
import {
  ensureAnonymousSession,
  waitForAuthReady,
} from '../services/auth/firebase';

const AUTH_STORAGE_KEY = '@pointo_auth';
const DEVICE_STORAGE_KEY = '@pointo_device';

/** 점주가 로그인한 소셜 제공자 */
export type OwnerProvider = 'google' | 'apple';

type AuthSession = {
  storeCode: string;
  storeName: string | null;
  mode: 'supervisor' | 'client';
  // 점주 계정 식별자
  ownerUid?: string | null;
  ownerEmail?: string | null;
  ownerProvider?: OwnerProvider | null;
};

/**
 * 기기 단위 설정 — 로그아웃/스토어 전환과 무관하게 이 기기에 고정된다.
 * 카운터 태블릿을 고객 전용으로 잠글 때 사용. (마찰완화 #2/#3)
 */
type DeviceConfig = {
  /** 이 기기를 특정 스토어의 고객 모드로 고정. null이면 잠금 없음. */
  lockedStoreCode: string | null;
  lockedStoreName: string | null;
  /** 고객 모드 해제(관리자 복귀)에 필요한 4자리 PIN. null이면 잠금 없음. */
  pin: string | null;
};

type AuthContextType = {
  /** 스토어+모드가 활성화되어 MainTab에 진입한 상태 */
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  initializeAuth: () => Promise<void>;
  mode: 'supervisor' | 'client';
  setMode: React.Dispatch<React.SetStateAction<'supervisor' | 'client'>>;
  storeCode: string | null;
  initStoreCode: React.Dispatch<React.SetStateAction<string | null>>;
  storeName: string | null;
  setStoreName: React.Dispatch<React.SetStateAction<string | null>>;
  // 구글 계정 식별자
  ownerUid: string | null;
  setOwnerUid: React.Dispatch<React.SetStateAction<string | null>>;
  ownerEmail: string | null;
  setOwnerEmail: React.Dispatch<React.SetStateAction<string | null>>;
  ownerProvider: OwnerProvider | null;
  setOwnerProvider: React.Dispatch<React.SetStateAction<OwnerProvider | null>>;
  // 기기 고객모드 잠금 (마찰완화)
  deviceLock: DeviceConfig;
  /** 이 기기를 고객 모드로 고정 + PIN 설정 */
  lockDeviceToClient: (
    storeCode: string,
    storeName: string | null,
    pin: string,
  ) => Promise<void>;
  /** 잠금 해제 (PIN 검증은 호출부에서 선행) */
  unlockDevice: () => Promise<void>;
  isLoading: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

const EMPTY_DEVICE_LOCK: DeviceConfig = {
  lockedStoreCode: null,
  lockedStoreName: null,
  pin: null,
};

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState<'supervisor' | 'client'>('supervisor');
  const [storeCode, initStoreCode] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [ownerProvider, setOwnerProvider] = useState<OwnerProvider | null>(
    null,
  );
  const [deviceLock, setDeviceLock] = useState<DeviceConfig>(EMPTY_DEVICE_LOCK);
  const [isLoading, setIsLoading] = useState(true);

  const persistSession = useCallback(async (session: AuthSession | null) => {
    try {
      if (session) {
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      } else {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {}
  }, []);

  const initializeAuth = useCallback(async () => {
    try {
      const [storedSession, storedDevice, firebaseUser] = await Promise.all([
        AsyncStorage.getItem(AUTH_STORAGE_KEY),
        AsyncStorage.getItem(DEVICE_STORAGE_KEY),
        // Firestore 요청 전에 Firebase가 세션 복원을 끝내야 한다.
        // 안 기다리면 첫 요청이 무인증으로 판정돼 permission-denied가 난다.
        waitForAuthReady(),
      ]);

      // 기기 잠금 먼저 복원
      const device: DeviceConfig = storedDevice
        ? {...EMPTY_DEVICE_LOCK, ...JSON.parse(storedDevice)}
        : EMPTY_DEVICE_LOCK;
      setDeviceLock(device);

      // 마찰완화 #2: 기기가 고객 모드로 잠겨 있으면 세션과 무관하게 고객 모드로 강제 복귀
      if (device.lockedStoreCode) {
        // 고객 전용 기기는 점주 로그인이 없으므로 익명 세션으로 규칙을 통과시킨다.
        if (!firebaseUser) await ensureAnonymousSession();
        initStoreCode(device.lockedStoreCode);
        setStoreName(device.lockedStoreName);
        setMode('client');
        setIsAuthenticated(true);
        return;
      }

      // 마찰완화 #1: 마지막 세션(스토어+모드) 자동 복원
      if (storedSession) {
        const session: AuthSession = JSON.parse(storedSession);

        // 점주 세션인데 Firebase 세션이 없거나 익명이면 신뢰할 수 없다.
        // (Firebase Auth 도입 전 버전에서 업데이트된 기기가 여기 해당 —
        //  저장된 ownerUid는 제공자 id라 규칙을 통과하지 못한다)
        const ownerSessionValid =
          !!firebaseUser && !firebaseUser.isAnonymous;
        if (session.mode === 'supervisor' && !ownerSessionValid) {
          await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
          return; // 로그인 화면으로 떨어뜨린다
        }

        if (session.mode === 'client' && !firebaseUser) {
          await ensureAnonymousSession();
        }

        initStoreCode(session.storeCode);
        setStoreName(session.storeName);
        setMode(session.mode);
        // 저장값보다 실제 Firebase 세션을 우선한다 (레거시 uid가 남아있을 수 있다)
        setOwnerUid(firebaseUser?.uid ?? session.ownerUid ?? null);
        setOwnerEmail(session.ownerEmail ?? null);
        setOwnerProvider(session.ownerProvider ?? null);
        setIsAuthenticated(true);
      }
    } catch {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persistDevice = useCallback(async (device: DeviceConfig) => {
    try {
      if (device.lockedStoreCode) {
        await AsyncStorage.setItem(
          DEVICE_STORAGE_KEY,
          JSON.stringify(device),
        );
      } else {
        await AsyncStorage.removeItem(DEVICE_STORAGE_KEY);
      }
    } catch {}
  }, []);

  const lockDeviceToClient = useCallback(
    async (code: string, name: string | null, pin: string) => {
      const device: DeviceConfig = {
        lockedStoreCode: code,
        lockedStoreName: name,
        pin,
      };
      setDeviceLock(device);
      await persistDevice(device);
    },
    [persistDevice],
  );

  const unlockDevice = useCallback(async () => {
    setDeviceLock(EMPTY_DEVICE_LOCK);
    await persistDevice(EMPTY_DEVICE_LOCK);
  }, [persistDevice]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  /**
   * 고객 전용 기기(카운터 태블릿)의 익명 세션을 지켜본다.
   *
   * 매장 태블릿은 몇 달씩 무인으로 돌아간다. 그 사이 익명 계정이 사라지면
   * (Console에서 삭제, 토큰 폐기, 앱 데이터 초기화 등) 다시 만들어주는 곳이
   * 없어서 적립이 조용히 전부 실패한다 — 현장에서 알아채기도 어렵다.
   * 그래서 세션이 끊기면 즉시 다시 만든다.
   *
   * 기기 잠금이 걸린 경우로 한정한 이유: 점주가 로그아웃할 때도 세션이 null이
   * 되는데, 그 흐름은 signOutOwner가 이미 의도대로 처리한다. 잠금 기기는
   * 세션이 null일 정당한 이유가 없으므로 여기서만 개입한다.
   */
  useEffect(() => {
    if (!deviceLock.lockedStoreCode) return;

    const unsubscribe = onAuthStateChanged(
      getAuth(),
      (user: FirebaseAuthTypes.User | null) => {
        if (!user) {
          ensureAnonymousSession().catch(() => {});
        }
      },
    );
    return unsubscribe;
  }, [deviceLock.lockedStoreCode]);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && storeCode) {
      persistSession({
        storeCode,
        storeName,
        mode,
        ownerUid,
        ownerEmail,
        ownerProvider,
      });
    } else if (!isAuthenticated) {
      persistSession(null);
    }
  }, [
    isAuthenticated,
    storeCode,
    storeName,
    mode,
    ownerUid,
    ownerEmail,
    ownerProvider,
    isLoading,
    persistSession,
  ]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        initializeAuth,
        mode,
        setMode,
        storeCode,
        initStoreCode,
        storeName,
        setStoreName,
        ownerUid,
        setOwnerUid,
        ownerEmail,
        setOwnerEmail,
        ownerProvider,
        setOwnerProvider,
        deviceLock,
        lockDeviceToClient,
        unlockDevice,
        isLoading,
      }}>
      {children}
    </AuthContext.Provider>
  );
};
