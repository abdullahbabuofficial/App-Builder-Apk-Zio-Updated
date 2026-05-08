import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function SignIn() {
  const navigate = useNavigate();
  const { signedIn, ready, signInWithPassword, signInDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-0 font-mono text-[13px] text-bone-mid">
        Loading…
      </div>
    );
  }

  if (signedIn) return <Navigate to="/dashboard" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        await signInWithPassword(email.trim(), pwd);
        navigate("/dashboard");
      } else {
        signInDemo();
        navigate("/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-ink-0">
      {/* Left brand panel */}
      <aside className="relative hidden flex-1 overflow-hidden border-r border-line-1 bg-ink-1 lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid bg-grid-fade absolute inset-0 opacity-60" />
        <div className="absolute -right-32 top-1/3 h-[480px] w-[480px] rounded-full bg-signal/10 blur-3xl" />

        {/* Brand mark */}
        <div className="relative z-10 flex items-center gap-2.5 p-10">
          <img src="/logo-dark.png" alt="ApkZio" className="h-12 w-auto" />
        </div>

        {/* Hero */}
        <div className="relative z-10 max-w-xl px-10 pb-10">
          <div className="mb-3 flex items-center gap-2">
            <span className="live-dot" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-mid">
              4.2M devices · 312 apps · live
            </span>
          </div>
          <h1 className="font-display text-[60px] font-semibold leading-[1.05] tracking-tight text-bone balance">
            Push at the speed
            <br />
            of <span className="italic text-signal">attention.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-bone-mid">
            One control plane for every Android app you ship — devices, subscribers, campaigns, and analytics in a single warm-dark console built for the night shift.
          </p>

          {/* Stat marquee */}
          <div className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line-1 bg-line-1">
            {[
              { l: "Avg latency", v: "245ms", s: "p99" },
              { l: "Delivery rate", v: "98.4%", s: "rolling 7d" },
              { l: "Sent today", v: "1.4M", s: "across all apps" },
            ].map((s) => (
              <div key={s.l} className="bg-ink-1 p-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">{s.l}</div>
                <div className="mt-1 font-display text-[28px] font-semibold leading-none text-bone num">{s.v}</div>
                <div className="mt-1 text-[11px] text-bone-low">{s.s}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-2 font-mono text-[11px] text-bone-low">
            <span>SOC 2 TYPE II</span>
            <span>·</span>
            <span>HIPAA-READY</span>
            <span>·</span>
            <span>EU-WEST · AP-SOUTH · US-EAST</span>
          </div>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex w-full flex-1 items-center justify-center p-6 sm:p-10 lg:max-w-[560px]">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <img src="/logo.png" alt="ApkZio" className="h-12 w-auto" />
          </div>

          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">
            Welcome back
          </div>
          <h2 className="font-display text-[36px] font-semibold leading-tight tracking-tight text-bone balance">
            Sign in to your console
          </h2>
          <p className="mt-3 text-[14px] text-bone-mid">
            {isSupabaseConfigured
              ? import.meta.env.PROD
                ? "Sign in with your Supabase Auth email and password. Demo sessions are not used in production."
                : "Sign in with your Supabase Auth email and password."
              : "Demo mode: any email/password continues without Supabase (set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY for real auth)."}
          </p>

          <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-4">
            <Field label="Email" required>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                leading={<Icon.Bell size={14} />}
              />
            </Field>
            <Field label="Password" required>
              <Input
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Enter your password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="text-bone-low hover:text-bone"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? <Icon.EyeOff size={14} /> : <Icon.Eye size={14} />}
                  </button>
                }
              />
            </Field>
            {error ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
                {error}
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-[12px] text-bone-mid">
                <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded border-line-2 bg-ink-2 text-signal focus:ring-signal/30" />
                Keep me signed in
              </label>
              <a href="#" className="text-[12px] text-bone-mid hover:text-signal">
                Forgot password?
              </a>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={submitting || (isSupabaseConfigured && (!email.trim() || !pwd))}
            >
              {submitting ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-ink-0" />
                  Signing you in…
                </>
              ) : (
                <>Continue <Icon.ArrowRight size={16} /></>
              )}
            </Button>
            <Button variant="outline" size="lg" fullWidth leading={<Icon.Sparkles size={15} />}>
              Continue with SSO (SAML)
            </Button>
          </form>

          <p className="mt-10 text-[12px] text-bone-low">
            New here? <a href="#" className="text-signal hover:underline">Create an account</a> · By continuing you agree to the <a href="#" className="text-bone-mid hover:text-bone">Terms</a> and <a href="#" className="text-bone-mid hover:text-bone">Privacy Policy</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
