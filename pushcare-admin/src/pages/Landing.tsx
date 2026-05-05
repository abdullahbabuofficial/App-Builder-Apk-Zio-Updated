import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";

const FEATURES = [
  {
    icon: <Icon.Phone size={18} />,
    title: "Devices",
    desc: "Realtime install, heartbeat, and token health for every Android shipped.",
  },
  {
    icon: <Icon.Send size={18} />,
    title: "Campaigns",
    desc: "Compose, target, schedule, and observe pushes from one warm-dark console.",
  },
  {
    icon: <Icon.Trend size={18} />,
    title: "Analytics",
    desc: "Delivery, opens, clicks, and conversions stitched to user cohorts in seconds.",
  },
];

const CODE_SAMPLES = [
  {
    title: "SDK",
    icon: <Icon.Code size={16} />,
    desc: "Drop-in client. Two lines to onboard.",
    code: `import { PushCare } from "pushcare-android"

PushCare.init(this, "pk_live_…")
PushCare.subscribe()`,
  },
  {
    title: "Edge Functions",
    icon: <Icon.Zap size={16} />,
    desc: "Trigger a push from anywhere with a signed POST.",
    code: `curl -X POST https://api.pushcare.io/sdk/init \\
  -H "x-api-key: pk_live_…" \\
  -d '{"package":"io.acme.app"}'`,
  },
  {
    title: "Postgres",
    icon: <Icon.Layers size={16} />,
    desc: "Your data, your tenant — RLS-scoped, audit-logged.",
    code: `select count(*)
from devices
where app_id = 'acme'
  and last_seen_at > now() - interval '24h';`,
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-ink-0 text-bone">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-line-1/80 bg-ink-0/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-signal text-ink-0">
              <Icon.Logo size={18} />
            </div>
            <span className="font-display text-[18px] font-semibold tracking-tight">PushCare</span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-bone-mid sm:flex">
            <Link to="/pricing" className="hover:text-bone">Pricing</Link>
            <a href="#features" className="hover:text-bone">Features</a>
            <a href="#engineers" className="hover:text-bone">Developers</a>
            <Link to="/sign-in" className="hover:text-bone">Sign in</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/sign-in" className="hidden sm:block">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary" size="sm" trailing={<Icon.ArrowRight size={13} />}>Start free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line-1">
        <div className="bg-grid-fade absolute inset-0 opacity-50" />
        <div className="absolute -right-32 top-1/2 h-[480px] w-[480px] -translate-y-1/2 rounded-full bg-signal/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
          <div className="mb-3 flex items-center gap-2">
            <span className="live-dot" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-mid">
              4.2M devices · 312 apps · live
            </span>
          </div>
          <h1 className="font-display text-[56px] font-semibold leading-[1.05] tracking-tight text-bone sm:text-[80px]">
            Push at the speed
            <br />
            of <span className="italic text-signal">attention.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-bone-mid sm:text-[17px]">
            One control plane for every Android app you ship — devices, subscribers, campaigns, and analytics in a single warm-dark console built for the night shift.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/signup">
              <Button variant="primary" size="lg" trailing={<Icon.ArrowRight size={16} />}>
                Start free
              </Button>
            </Link>
            <Link to="/sign-in">
              <Button variant="outline" size="lg">Sign in</Button>
            </Link>
            <span className="font-mono text-[11px] text-bone-low">No credit card · 100k pushes / mo</span>
          </div>

          {/* Stat marquee */}
          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line-1 bg-line-1 sm:grid-cols-3">
            {[
              { l: "Avg latency", v: "245ms", s: "p99" },
              { l: "Delivery rate", v: "98.4%", s: "rolling 7d" },
              { l: "Sent today", v: "1.4M", s: "across all apps" },
            ].map((s) => (
              <div key={s.l} className="bg-ink-1 p-5 sm:p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">{s.l}</div>
                <div className="mt-1 font-display text-[32px] font-semibold leading-none text-bone num">{s.v}</div>
                <div className="mt-1 text-[11px] text-bone-low">{s.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-line-1">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="mb-10 max-w-xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">What's inside</div>
            <h2 className="mt-2 font-display text-[36px] font-semibold leading-tight tracking-tight text-bone sm:text-[44px]">
              Every layer of the push stack — visible.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line-1 bg-line-1 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-ink-1 p-6 sm:p-8">
                <div className="grid h-10 w-10 place-items-center rounded-md border border-line-1 bg-ink-2 text-signal">
                  {f.icon}
                </div>
                <div className="mt-5 font-display text-[20px] font-semibold leading-tight text-bone">{f.title}</div>
                <p className="mt-2 text-[14px] leading-relaxed text-bone-mid">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for engineers */}
      <section id="engineers" className="border-b border-line-1">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="mb-10 max-w-2xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">Built for engineers</div>
            <h2 className="mt-2 font-display text-[36px] font-semibold leading-tight tracking-tight text-bone sm:text-[44px]">
              An SDK and an API that <span className="italic text-signal">stay out of your way.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {CODE_SAMPLES.map((s) => (
              <div key={s.title} className="rounded-xl border border-line-1 bg-ink-1 p-5">
                <div className="flex items-center gap-2 text-bone">
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-line-1 bg-ink-2 text-signal">
                    {s.icon}
                  </span>
                  <span className="font-display text-[15px] font-semibold">{s.title}</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-bone-mid">{s.desc}</p>
                <pre className="mt-4 overflow-x-auto rounded-lg border border-line-1 bg-ink-0 p-4 font-mono text-[11.5px] leading-relaxed text-bone">
                  <code>{s.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-b border-line-1">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-line-1 bg-ink-1 p-8 sm:flex-row sm:items-center sm:p-10">
            <div className="max-w-md">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">Pricing</div>
              <h3 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-tight text-bone sm:text-[34px]">
                Free to start. Predictable as you scale.
              </h3>
              <p className="mt-2 text-[14px] text-bone-mid">
                100k pushes a month, free, forever. Pro starts at $99 / mo. Enterprise gets SLAs and SAML.
              </p>
            </div>
            <Link to="/pricing">
              <Button variant="primary" size="lg" trailing={<Icon.ArrowRight size={16} />}>
                See plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink-0">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-signal text-ink-0">
                <Icon.Logo size={15} />
              </div>
              <span className="font-display text-[15px] font-semibold tracking-tight">PushCare</span>
              <span className="font-mono text-[11px] text-bone-low">© {new Date().getFullYear()}</span>
            </div>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-bone-low">
              <Link to="/pricing" className="hover:text-bone">Pricing</Link>
              <Link to="/sign-in" className="hover:text-bone">Sign in</Link>
              <Link to="/signup" className="hover:text-bone">Sign up</Link>
              <Link to="/legal/terms" className="hover:text-bone">Terms</Link>
              <Link to="/legal/privacy" className="hover:text-bone">Privacy</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
