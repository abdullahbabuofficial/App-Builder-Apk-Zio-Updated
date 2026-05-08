import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  forgotPasswordRequest,
  getCurrentUser,
  loginUser,
  loginWithGoogleIdToken,
  logoutUser,
  registerUser,
  resendVerificationRequest,
  resetPasswordRequest,
  verifyEmailRequest,
  type User,
} from '../lib/api';
import {
  clearAuth,
  getToken,
  getUser,
  setToken,
  setUser,
} from '../lib/auth-storage';

export type AuthCtx = {
  token: string | null;
  user: User | null;
  ready: boolean;
  isAuthenticated: boolean;
  register: (input: { email: string; password: string; full_name: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUserState] = useState<User | null>(() => getUser());
  const [ready, setReady] = useState(false);
  const hydratedRef = useRef(false);

  const applySession = useCallback((nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    setTokenState(nextToken);
    setUserState(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    clearAuth();
    setTokenState(null);
    setUserState(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try {
      const { user: fresh } = await getCurrentUser();
      setUser(fresh);
      setUserState(fresh);
    } catch {
      // 401 already clears storage inside the api layer; mirror that here.
      if (!getToken()) {
        setTokenState(null);
        setUserState(null);
      }
    }
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    let cancelled = false;
    (async () => {
      const stored = getToken();
      if (!stored) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const { user: fresh } = await getCurrentUser();
        if (cancelled) return;
        setUser(fresh);
        setUserState(fresh);
      } catch {
        if (cancelled) return;
        if (!getToken()) {
          setTokenState(null);
          setUserState(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback<AuthCtx['register']>(
    async (input) => {
      const { token: nextToken, user: nextUser } = await registerUser(input);
      applySession(nextToken, nextUser);
    },
    [applySession],
  );

  const login = useCallback<AuthCtx['login']>(
    async (input) => {
      const { token: nextToken, user: nextUser } = await loginUser(input);
      applySession(nextToken, nextUser);
    },
    [applySession],
  );

  const loginWithGoogle = useCallback<AuthCtx['loginWithGoogle']>(async () => {
    const { signInWithGoogleAndGetIdToken } = await import('../lib/firebase-google-auth');
    const idToken = await signInWithGoogleAndGetIdToken();
    const { token: nextToken, user: nextUser } = await loginWithGoogleIdToken(idToken);
    applySession(nextToken, nextUser);
  }, [applySession]);

  const logout = useCallback<AuthCtx['logout']>(async () => {
    try {
      await logoutUser();
    } catch {
      // best-effort: still drop local session
    }
    clearSession();
  }, [clearSession]);

  const forgotPassword = useCallback<AuthCtx['forgotPassword']>(async (email) => {
    await forgotPasswordRequest(email);
  }, []);

  const resetPassword = useCallback<AuthCtx['resetPassword']>(
    async (resetToken, password) => {
      const { token: nextToken, user: nextUser } = await resetPasswordRequest(
        resetToken,
        password,
      );
      applySession(nextToken, nextUser);
    },
    [applySession],
  );

  const verifyEmail = useCallback<AuthCtx['verifyEmail']>(
    async (verifyToken) => {
      const { user: fresh } = await verifyEmailRequest(verifyToken);
      setUser(fresh);
      setUserState(fresh);
    },
    [],
  );

  const resendVerification = useCallback<AuthCtx['resendVerification']>(async () => {
    await resendVerificationRequest();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      token,
      user,
      ready,
      isAuthenticated: Boolean(token && user),
      register,
      login,
      loginWithGoogle,
      logout,
      forgotPassword,
      resetPassword,
      verifyEmail,
      resendVerification,
      refreshUser,
    }),
    [
      token,
      user,
      ready,
      register,
      login,
      loginWithGoogle,
      logout,
      forgotPassword,
      resetPassword,
      verifyEmail,
      resendVerification,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
