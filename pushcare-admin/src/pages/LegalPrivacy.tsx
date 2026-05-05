import { Link } from "react-router-dom";
import { Icon } from "@/lib/icons";

export function LegalPrivacy() {
  return (
    <div className="min-h-screen bg-ink-0 text-bone">
      <header className="border-b border-line-1/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-signal text-ink-0">
              <Icon.Logo size={18} />
            </div>
            <span className="font-display text-[17px] font-semibold tracking-tight">PushCare</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-mid hover:text-bone"
          >
            <Icon.ArrowLeft size={12} /> Back home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">Legal</div>
        <h1 className="mt-2 font-display text-[40px] font-semibold tracking-tight text-bone sm:text-[52px]">
          Privacy policy
        </h1>
        <div className="mt-4 rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-[12.5px] text-warn">
          Replace with real legal counsel-reviewed text before launch.
        </div>

        <div className="mt-10 space-y-6 text-[14px] leading-relaxed text-bone-mid">
          <Section heading="What we collect">
            We collect data you submit (account info, payment details), data your apps generate (push events, install
            hashes, geo and device metadata), and standard server logs. We do not sell personal data.
          </Section>
          <Section heading="How we use it">
            To provide the Service: routing pushes, computing analytics, billing, security monitoring, and support.
            We may use de-identified, aggregated data to improve the platform.
          </Section>
          <Section heading="Data sharing">
            We share data with sub-processors (cloud hosting, payment processors, error monitoring) under data
            processing agreements. We never sell or rent personal information.
          </Section>
          <Section heading="Storage and retention">
            Customer data is stored in regional Postgres clusters. Free plan retains 7 days of analytics; Pro retains
            90 days; Enterprise is configurable. Account data is deleted within 30 days of termination unless legally
            required to retain.
          </Section>
          <Section heading="Your rights">
            You can export, correct, or delete your data via the dashboard or by emailing{" "}
            <a href="mailto:privacy@pushcare.io" className="text-signal hover:underline">
              privacy@pushcare.io
            </a>
            . EU and California residents have additional rights under GDPR and CCPA.
          </Section>
          <Section heading="Children's privacy">
            The Service is not directed to children under 13. We do not knowingly collect data from children. Contact
            us if you believe we have inadvertently collected such data so we can delete it.
          </Section>
          <Section heading="Security">
            Data is encrypted in transit (TLS 1.3) and at rest (AES-256). We follow SOC 2 Type II controls. Disclose
            vulnerabilities to{" "}
            <a href="mailto:security@pushcare.io" className="text-signal hover:underline">
              security@pushcare.io
            </a>
            .
          </Section>
          <Section heading="Changes to this policy">
            We may update this policy. We'll notify you of material changes via email or in-app banner at least 30
            days before they take effect.
          </Section>
        </div>

        <p className="mt-12 font-mono text-[11px] text-bone-low">Last updated: {new Date().toLocaleDateString()}</p>
      </main>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[18px] font-semibold text-bone">{heading}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
