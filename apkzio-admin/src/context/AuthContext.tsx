import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase/client";

type AuthCtx = {
  session: Session | null;
  ready: boolean;
  signedIn: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInDemo: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const DEMO_KEY = "pc_signed_in";

/** Production builds with real Supabase env must never treat demo localStorage as a session. */
const prodBlocksDemoStorage = import.meta.env.PROD && isSupabaseConfigured;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [demoSignedIn, setDemoSignedIn] = useState(() => {
    if (typeof window === "undefined") return false;
    if (prodBlocksDemoStorage) return false;
    return localStorage.getItem(DEMO_KEY) === "1";
  });
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (prodBlocksDemoStorage) {
      localStorage.removeItem(DEMO_KEY);
      setDemoSignedIn(false);
    }
  }, []);

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

  const signedIn = Boolean(session?.user) || (!isSupabaseConfigured && demoSignedIn);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabaseBrowser) throw new Error("Supabase is not configured");
    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
  }, []);

  const signInDemo = useCallback(() => {
    if (isSupabaseConfigured) {
      throw new Error(
        import.meta.env.PROD
          ? "Demo sign-in is not available in production when Supabase is configured."
          : "Demo sign-in is disabled when Supabase env is set.",
      );
    }
    localStorage.setItem(DEMO_KEY, "1");
    setDemoSignedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(DEMO_KEY);
    setDemoSignedIn(false);
    if (supabaseBrowser) await supabaseBrowser.auth.signOut();
  }, []);

  const value = useMemo(
    (): AuthCtx => ({
      session,
      ready,
      signedIn,
      signInWithPassword,
      signInDemo,
      signOut,
    }),
    [session, ready, signedIn, signInWithPassword, signInDemo, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
