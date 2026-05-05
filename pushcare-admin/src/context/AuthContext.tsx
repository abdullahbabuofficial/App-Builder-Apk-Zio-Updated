import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase/client";
import { setPushcareRestAccessToken } from "@/lib/api";
import { restLogin, restLogout, restMe, type RestUser } from "@/lib/authRest";
import { PUSHCARE_API_URL } from "@/lib/config";

type AuthCtx = {
  session: Session | null;
  ready: boolean;
  signedIn: boolean;
  /** True when we're authenticated via the local-api REST `/api/auth/login` flow. */
  restSignedIn: boolean;
  /** REST user record when `restSignedIn` is true. */
  restUser: RestUser | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInDemo: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const DEMO_KEY = "pc_signed_in";
const REST_TOKEN_KEY = "pc_rest_token";

function readStoredRestToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REST_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredRestToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(REST_TOKEN_KEY, token);
    else localStorage.removeItem(REST_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [demoSignedIn, setDemoSignedIn] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DEMO_KEY) === "1",
  );
  const [ready, setReady] = useState(!isSupabaseConfigured);

  // REST auth state. We initialize the token early so apiFetch sees it on the
  // first render — useful for `/api/auth/me` validation below.
  const [restToken, setRestToken] = useState<string | null>(() => readStoredRestToken());
  const [restUser, setRestUser] = useState<RestUser | null>(null);
  const restValidatedRef = useRef(false);

  // Push the token into the api module so all REST helpers attach Authorization.
  // (PushcareDataContext also calls setPushcareRestAccessToken when it has a
  //  Supabase session — those two paths don't conflict because rest-mode is
  //  only chosen when isSupabaseConfigured is false. PushcareDataContext is
  //  careful not to overwrite our token when it has no Supabase session.)
  useEffect(() => {
    if (restToken) {
      setPushcareRestAccessToken(restToken);
    } else if (!isSupabaseConfigured) {
      // No REST token AND no Supabase — make sure stale tokens are cleared.
      setPushcareRestAccessToken(null);
    }
  }, [restToken]);

  // Validate any stored REST token on startup via /api/auth/me.
  useEffect(() => {
    if (restValidatedRef.current) return;
    restValidatedRef.current = true;
    if (!restToken) return;
    if (!PUSHCARE_API_URL) return;
    let cancelled = false;
    (async () => {
      const me = await restMe();
      if (cancelled) return;
      if (me) {
        setRestUser(me);
      } else {
        // Stale token — clear it so the user falls back to the sign-in screen.
        writeStoredRestToken(null);
        setRestToken(null);
        setPushcareRestAccessToken(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restToken]);

  useEffect(() => {
    if (!supabaseBrowser) return;

    void supabaseBrowser.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        setReady(true);
      });

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => subscription.unsubscribe();
  }, []);

  const restSignedIn = Boolean(restToken && restUser);
  const signedIn =
    Boolean(session?.user) ||
    restSignedIn ||
    (!isSupabaseConfigured && demoSignedIn);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    // Prefer Supabase when configured, otherwise fall back to the local-api
    // REST flow.
    if (supabaseBrowser) {
      const { error } = await supabaseBrowser.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      return;
    }

    if (!PUSHCARE_API_URL) {
      throw new Error(
        "No auth backend configured. Set VITE_SUPABASE_URL or VITE_PUSHCARE_API_URL.",
      );
    }

    const { access_token, user } = await restLogin(email, password);
    writeStoredRestToken(access_token);
    setPushcareRestAccessToken(access_token);
    setRestToken(access_token);
    setRestUser(user);
  }, []);

  const signInDemo = useCallback(() => {
    if (isSupabaseConfigured) {
      throw new Error("Demo sign-in disabled when Supabase env is set");
    }
    localStorage.setItem(DEMO_KEY, "1");
    setDemoSignedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(DEMO_KEY);
    setDemoSignedIn(false);

    // Clear REST session
    if (restToken) {
      await restLogout();
    }
    writeStoredRestToken(null);
    setPushcareRestAccessToken(null);
    setRestToken(null);
    setRestUser(null);

    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
  }, [restToken]);

  const value = useMemo(
    (): AuthCtx => ({
      session,
      ready,
      signedIn,
      restSignedIn,
      restUser,
      signInWithPassword,
      signInDemo,
      signOut,
    }),
    [session, ready, signedIn, restSignedIn, restUser, signInWithPassword, signInDemo, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
