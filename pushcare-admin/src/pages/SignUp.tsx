import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase/client";
import { PUSHCARE_API_URL } from "@/lib/config";

type SignupBody = {
  email: string;
  password?: string;
  display_name?: string | null;
  plan?: string | null;
  app?: { package_name: string; app_name: string } | null;
};

async function postSignupInit(body: SignupBody): Promise<void> {
  if (!PUSHCARE_API_URL) return; // mock — nothing to call
  const res = await fetch(`${PUSHCARE_API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 409) {
    let msg = res.statusText;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      msg = data.error?.message ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg || "Signup failed");
  }
}

function passwordChecks(pwd: string): { length: boolean; lower: boolean; upper: boolean; digit: boolean } {
  return {
    length: pwd.length >= 12,
    lower: /[a-z]/.test(pwd),
    upper: /[A-Z]/.test(pwd),
    digit: /\d/.test(pwd),
  };
}

function passwordScore(pwd: string): number {
  const c = passwordChecks(pwd);
  return [c.length, c.lower, c.upper, c.digit].filter(Boolean).length;
}

export function SignUp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const planHint = params.get("plan");
  const { signedIn, ready, signInDemo } = useAuth();

  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [appOpen, setAppOpen] = useState(false);
  const [packageName, setPackageName] = useState("");
  const [appName, setAppName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = useMemo(() => passwordChecks(pwd), [pwd]);
  const score = useMemo(() => passwordScore(pwd), [pwd]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-0 font-mono text-[13px] text-bone-mid">
        Loading…
      </div>
    );
  }
  if (signedIn) return <Navigate to="/dashboard" replace />;

  const valid =
    email.trim().length > 3 &&
    email.includes("@") &&
    (isSupabaseConfigured ? score >= 3 : true);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const trimmedEmail = email.trim().toLowerCase();
    const starterApp =
      packageName.trim() && appName.trim()
        ? { package_name: packageName.trim(), app_name: appName.trim() }
        : null;

    try {
      if (isSupabaseConfigured && supabaseBrowser) {
        const { error: authErr } = await supabaseBrowser.auth.signUp({
          email: trimmedEmail,
          password: pwd,
          options: {
            data: { display_name: displayName.trim() || null },
          },
        });
        if (authErr) throw authErr;

        // In production this work happens server-side via the signup-init Edge Function.
        try {
          await postSignupInit({
            email: trimmedEmail,
            display_name: displayName.trim() || null,
            plan: planHint,
            app: starterApp,
          });
        } catch {
          // best-effort — supabase auth row is created; surface in onboarding instead
        }
        navigate("/onboarding");
        return;
      }

      if (PUSHCARE_API_URL) {
        await postSignupInit({
          email: trimmedEmail,
          password: pwd || undefined,
          display_name: displayName.trim() || null,
          plan: planHint,
          app: starterApp,
        });
        // No Supabase Auth → fall back to demo session so the user can keep moving.
        if (!isSupabaseConfigured) signInDemo();
        navigate("/onboarding");
        return;
      }

      // Pure mock — demo signin and continue.
      signInDemo();
      navigate("/onboarding");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-ink-0">
      {/* Left brand panel */}
      <aside className="relative hidden flex-1 overflow-hidden border-r border-line-1 bg-ink-1 lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid-fade absolute inset-0 opacity-60" />
        <div className="absolute -right-32 top-1/3 h-[480px] w-[480px] rounded-full bg-signal/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-2.5 p-10">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-signal text-ink-0">
              <Icon.Logo size={20} />
            </div>
            <span className="font-display text-[20px] font-semibold tracking-tight">PushCare</span>
          </Link>
        </div>

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
            Sign up to ship your first push in under five minutes. Free for the first 100k pushes a month — no credit card required.
          </p>

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
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-signal text-ink-0">
                <Icon.Logo size={20} />
              </div>
              <span className="font-display text-[20px] font-semibold tracking-tight">PushCare</span>
            </Link>
          </div>

          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">
            {planHint ? `Plan · ${planHint.toUpperCase()}` : "Get started"}
          </div>
          <h2 className="font-display text-[36px] font-semibold leading-tight tracking-tight text-bone balance">
            Create your account
          </h2>
          <p className="mt-3 text-[14px] text-bone-mid">
            {isSupabaseConfigured
              ? "Sign up with email and a strong password."
              : "Demo mode: any email works. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY for real auth."}
          </p>

          <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-4">
            <Field label="Work email" required>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                leading={<Icon.Bell size={14} />}
              />
            </Field>
            <Field label="Display name" hint="Shown to your teammates.">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Abdullah Babu"
                autoComplete="name"
              />
            </Field>
            <Field
              label="Password"
              required={isSupabaseConfigured}
              hint={isSupabaseConfigured ? "Minimum 12 characters with mixed case + a digit." : undefined}
            >
              <Input
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="At least 12 characters"
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

            {pwd.length > 0 && (
              <div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-3">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-full flex-1",
                        i > 0 && "border-l border-ink-1",
                        i < score
                          ? score < 2
                            ? "bg-danger"
                            : score < 4
                              ? "bg-warn"
                              : "bg-signal"
                          : "bg-transparent",
                      )}
                    />
                  ))}
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-bone-low">
                  <PwHint ok={checks.length} label="12+ chars" />
                  <PwHint ok={checks.lower} label="lowercase" />
                  <PwHint ok={checks.upper} label="uppercase" />
                  <PwHint ok={checks.digit} label="digit" />
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setAppOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-md border border-line-1 bg-ink-2/40 px-3 py-2 text-left text-[12px] text-bone-mid hover:border-line-2 hover:text-bone"
            >
              <span className="flex items-center gap-2">
                <Icon.Layers size={13} />
                Add a starter app (optional)
              </span>
              <Icon.ChevronDown size={13} className={cn("transition-transform", appOpen && "rotate-180")} />
            </button>
            {appOpen && (
              <div className="space-y-3 rounded-md border border-line-1 bg-ink-2/30 p-3">
                <Field label="App name">
                  <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="My News App" />
                </Field>
                <Field label="Package name">
                  <Input
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="io.acme.news"
                    className="font-mono"
                  />
                </Field>
              </div>
            )}

            {error ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={submitting || !valid}
            >
              {submitting ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-ink-0" />
                  Creating your workspace…
                </>
              ) : (
                <>Create account <Icon.ArrowRight size={16} /></>
              )}
            </Button>
          </form>

          <p className="mt-8 text-[12px] text-bone-low">
            Already have an account?{" "}
            <Link to="/sign-in" className="text-signal hover:underline">Sign in</Link>
            {" · By continuing you agree to the "}
            <Link to="/legal/terms" className="text-bone-mid hover:text-bone">Terms</Link>
            {" and "}
            <Link to="/legal/privacy" className="text-bone-mid hover:text-bone">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

function PwHint({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn("inline-flex items-center gap-1.5", ok ? "text-signal" : "text-bone-low")}>
      {ok ? <Icon.Check size={10} /> : <span className="block h-1.5 w-1.5 rounded-full bg-bone-low" />}
      {label}
    </li>
  );
}
