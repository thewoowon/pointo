import React, {createContext, useCallback, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEY = '@pointo_auth';
const DEVICE_STORAGE_KEY = '@pointo_device';

type AuthSession = {
  storeCode: string;
  storeName: string | null;
  mode: 'supervisor' | 'client';
  // 구글 계정 식별자
  ownerUid?: string | null;
  ownerEmail?: string | null;
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
      const [storedSession, storedDevice] = await Promise.all([
        AsyncStorage.getItem(AUTH_STORAGE_KEY),
        AsyncStorage.getItem(DEVICE_STORAGE_KEY),
      ]);

      // 기기 잠금 먼저 복원
      const device: DeviceConfig = storedDevice
        ? {...EMPTY_DEVICE_LOCK, ...JSON.parse(storedDevice)}
        : EMPTY_DEVICE_LOCK;
      setDeviceLock(device);

      // 마찰완화 #2: 기기가 고객 모드로 잠겨 있으면 세션과 무관하게 고객 모드로 강제 복귀
      if (device.lockedStoreCode) {
        initStoreCode(device.lockedStoreCode);
        setStoreName(device.lockedStoreName);
        setMode('client');
        setIsAuthenticated(true);
        return;
      }

      // 마찰완화 #1: 마지막 세션(스토어+모드) 자동 복원
      if (storedSession) {
        const session: AuthSession = JSON.parse(storedSession);
        initStoreCode(session.storeCode);
        setStoreName(session.storeName);
        setMode(session.mode);
        setOwnerUid(session.ownerUid ?? null);
        setOwnerEmail(session.ownerEmail ?? null);
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

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && storeCode) {
      persistSession({storeCode, storeName, mode, ownerUid, ownerEmail});
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
        deviceLock,
        lockDeviceToClient,
        unlockDevice,
        isLoading,
      }}>
      {children}
    </AuthContext.Provider>
  );
};
