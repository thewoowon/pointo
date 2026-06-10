import React, {createContext, useCallback, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEY = '@pointo_auth';

type AuthSession = {
  storeCode: string;
  storeName: string | null;
  mode: 'supervisor' | 'client';
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
      persistSession({storeCode, storeName, mode});
    } else if (!isAuthenticated) {
      persistSession(null);
    }
  }, [isAuthenticated, storeCode, storeName, mode, isLoading, persistSession]);

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
        isLoading,
      }}>
      {children}
    </AuthContext.Provider>
  );
};
