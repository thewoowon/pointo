import React, {createContext, useCallback, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEY = '@pointo_auth';

type AuthSession = {
  storeCode: string;
  storeName: string | null;
  mode: 'supervisor' | 'client';
  // 이메일 계정으로 로그인한 경우의 식별자 (스토어 코드 로그인은 없음 → 옵셔널)
  ownerUid?: string | null;
  ownerEmail?: string | null;
};

type AuthContextType = {
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  initializeAuth: () => Promise<void>;
  mode: 'supervisor' | 'client';
  setMode: React.Dispatch<React.SetStateAction<'supervisor' | 'client'>>;
  storeCode: string | null;
  initStoreCode: React.Dispatch<React.SetStateAction<string | null>>;
  storeName: string | null;
  setStoreName: React.Dispatch<React.SetStateAction<string | null>>;
  // 이메일 계정 식별자. 스토어 코드 로그인 시에는 null (하위호환)
  ownerUid: string | null;
  setOwnerUid: React.Dispatch<React.SetStateAction<string | null>>;
  ownerEmail: string | null;
  setOwnerEmail: React.Dispatch<React.SetStateAction<string | null>>;
  isLoading: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState<'supervisor' | 'client'>('supervisor');
  const [storeCode, initStoreCode] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
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
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const session: AuthSession = JSON.parse(stored);
        initStoreCode(session.storeCode);
        setStoreName(session.storeName);
        setMode(session.mode);
        // 기존(필드 없는) 세션도 안전하게 복원 — 옵셔널 체이닝으로 undefined 허용
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
        isLoading,
      }}>
      {children}
    </AuthContext.Provider>
  );
};
