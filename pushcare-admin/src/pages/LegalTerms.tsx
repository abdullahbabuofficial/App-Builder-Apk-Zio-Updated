import { Link } from "react-router-dom";
import { Icon } from "@/lib/icons";

export function LegalTerms() {
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
          Terms of service
        </h1>
        <div className="mt-4 rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-[12.5px] text-warn">
          Replace with real legal counsel-reviewed text before launch.
        </div>

        <div className="prose-pushcare mt-10 space-y-6 text-[14px] leading-relaxed text-bone-mid">
          <Section heading="1. Agreement to terms">
            By accessing or using PushCare ("Service"), you agree to be bound by these Terms. If you do not agree, do
            not use the Service. These Terms apply to the company, its affiliates, and authorized resellers.
          </Section>
          <Section heading="2. Accounts">
            You are responsible for safeguarding your credentials and any activity under your account. Notify us
            immediately of unauthorized use. We may suspend accounts that violate these Terms or applicable laws.
          </Section>
          <Section heading="3. Acceptable use">
            You agree not to use the Service to send spam, malware, content that infringes intellectual property,
            content prohibited by law, or to abuse, harass, or deceive recipients of push notifications.
          </Section>
          <Section heading="4. Customer data">
            You retain all rights to data you submit. You grant us a limited license to host, transmit, and process
            your data solely to provide the Service. We act as a processor under applicable data-protection laws.
          </Section>
          <Section heading="5. Fees and billing">
            Paid plans renew automatically on the same calendar day each month unless canceled. Overage fees, if any,
            are billed in arrears. All fees are non-refundable except as required by law.
          </Section>
          <Section heading="6. Termination">
            Either party may terminate this agreement on 30 days' written notice. We may terminate immediately for
            material breach. Upon termination, your data may be deleted after a grace period.
          </Section>
          <Section heading="7. Disclaimers">
            The Service is provided "as is" without warranties of any kind, express or implied, including
            merchantability, fitness for a particular purpose, and non-infringement.
          </Section>
          <Section heading="8. Limitation of liability">
            To the maximum extent permitted by law, neither party is liable for indirect, incidental, or consequential
            damages. Each party's aggregate liability is limited to fees paid in the prior 12 months.
          </Section>
          <Section heading="9. Governing law">
            These Terms are governed by the laws of the State of Delaware, USA, without regard to its conflict-of-laws
            provisions. Disputes are exclusively resolved in Wilmington, Delaware.
          </Section>
          <Section heading="10. Contact">
            Questions? Email{" "}
            <a href="mailto:legal@pushcare.io" className="text-signal hover:underline">
              legal@pushcare.io
            </a>
            .
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
