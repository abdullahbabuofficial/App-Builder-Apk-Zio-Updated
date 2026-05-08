import { FileText } from 'lucide-react';
import { Link } from '../components/router';

export function TermsPage() {
  const sections = [
    {
      title: '1. Acceptance of Terms',
      content: 'By accessing and using ApkZio ("Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.',
    },
    {
      title: '2. Account Registration',
      content: 'To use our Service, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and for all activities that occur under your account.',
    },
    {
      title: '3. Service Description',
      content: 'ApkZio provides a platform to convert websites into Android APK and AAB applications. We offer various subscription plans with different features and build limits. The Service is provided "as is" and we reserve the right to modify, suspend, or discontinue any aspect of the Service at any time.',
    },
    {
      title: '4. Payment and Subscription',
      content: 'Subscription fees are billed in advance on a monthly or annual basis depending on your chosen plan. All fees are non-refundable except as required by law or as explicitly stated in our refund policy. You authorize us to charge your payment method for all fees incurred.',
    },
    {
      title: '5. Build Limitations',
      content: 'Each subscription plan includes a specific number of builds per month. Unused builds do not roll over to the following month. If you exceed your monthly build limit, you must upgrade your plan or wait until the next billing cycle.',
    },
    {
      title: '6. Cancellation and Refunds',
      content: 'You may cancel your subscription at any time. Upon cancellation, you will continue to have access to paid features until the end of your current billing period. We offer a 7-day money-back guarantee for first-time subscribers who are not satisfied with our service.',
    },
    {
      title: '7. User Responsibility',
      content: 'You are responsible for the content of websites you convert into apps. You must have the legal right to convert any website into an application. You agree not to use the Service for any illegal or unauthorized purpose, including but not limited to copyright infringement or distribution of malware.',
    },
    {
      title: '8. Prohibited Content',
      content: 'You may not use our Service to create apps containing: illegal content, malware or viruses, content that infringes intellectual property rights, adult content without proper age restrictions, or content that promotes violence, discrimination, or illegal activities.',
    },
    {
      title: '9. Service Availability',
      content: 'We work to keep the Service available, but we do not guarantee uninterrupted, error-free, or continuously available access. The Service may be unavailable from time to time for scheduled maintenance, upgrades, or for reasons outside of our reasonable control. Scheduled maintenance will be announced in advance when possible. We are not liable for any downtime, data loss, or inability to access the Service.',
    },
    {
      title: '10. Intellectual Property',
      content: 'The Service and its original content, features, and functionality are owned by ApkZio and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.',
    },
    {
      title: '11. Limitation of Liability',
      content: 'In no event shall ApkZio, its directors, employees, or agents be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.',
    },
    {
      title: '12. Changes to Terms',
      content: 'We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the Service. Your continued use of the Service after such modifications constitutes your acceptance of the updated terms.',
    },
  ];

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Terms of Service
            </h1>
            <p className="text-lg text-muted-foreground">
              Last updated: April 29, 2026
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl bg-card border border-border p-8 mb-12">
              <p className="text-muted-foreground">
                Please read these Terms of Service carefully before using the ApkZio platform. These terms govern your access to and use of our services, including our website, applications, and all related services.
              </p>
            </div>

            <div className="space-y-8">
              {sections.map((section, index) => (
                <div key={index} className="rounded-2xl bg-card border border-border p-8">
                  <h2 className="text-2xl font-bold mb-4">{section.title}</h2>
                  <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-border p-8">
              <h3 className="text-xl font-bold mb-4">Questions About Our Terms?</h3>
              <p className="text-muted-foreground mb-6">
                If you have any questions about these Terms of Service, please contact our legal team at legal@apkzio.com
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="mailto:legal@apkzio.com" className="text-primary hover:underline">
                  Contact Legal Team
                </a>
                <span className="text-muted-foreground hidden sm:inline">|</span>
                <Link to="/privacy" className="text-primary hover:underline">
                  View Privacy Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
