import { Shield } from 'lucide-react';

export function PrivacyPage() {
  const sections = [
    {
      title: '1. Information We Collect',
      content: 'We collect information you provide directly to us when you create an account, use our services, or communicate with us. This includes your name, email address, payment information, and website URLs you submit for conversion.',
    },
    {
      title: '2. Account Data',
      content: 'When you register for an account, we collect your name, email address, password, and company information. We use this information to create and manage your account, provide customer support, and communicate with you about our services.',
    },
    {
      title: '3. Payment Data',
      content: 'Payment information, including credit card numbers and billing addresses, is processed securely through our payment processor. We do not store complete credit card numbers on our servers. Only the last four digits and expiration date are retained for reference.',
    },
    {
      title: '4. App and Project Data',
      content: 'We store information about the apps you create, including website URLs, app configurations, build history, and generated APK/AAB files. This data is necessary to provide our core services and is retained as long as your account remains active.',
    },
    {
      title: '5. Usage Data and Cookies',
      content: 'We automatically collect information about how you interact with our Service, including your IP address, browser type, pages visited, and actions taken. We use cookies and similar technologies to enhance your experience and analyze usage patterns.',
    },
    {
      title: '6. Third-Party Service Providers',
      content: 'We work with third-party service providers to process payments, send emails, provide analytics, and deliver our services. These providers have access to your personal information only as needed to perform their functions and are obligated to maintain confidentiality.',
    },
    {
      title: '7. Data Security',
      content: 'We take reasonable technical and organizational measures designed to protect your personal information, including encryption in transit, restricted access to production systems, and ongoing security improvements. No method of transmission over the internet or electronic storage is fully secure, however, and we cannot guarantee absolute security. You are responsible for keeping your account credentials confidential.',
    },
    {
      title: '8. Data Retention',
      content: 'We retain your personal information for as long as your account is active or as needed to provide our services. If you close your account, we will delete or anonymize your data within 90 days, except where we are required to retain it for legal purposes.',
    },
    {
      title: '9. Your Privacy Rights',
      content: 'You have the right to access, correct, or delete your personal information. You can also object to processing, request data portability, and withdraw consent. To exercise these rights, contact us at privacy@apkzio.com.',
    },
    {
      title: '10. International Data Transfers',
      content: 'Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with applicable data protection laws.',
    },
    {
      title: '11. Children\'s Privacy',
      content: 'Our Service is not intended for users under the age of 13. We do not knowingly collect personal information from children. If we learn we have collected information from a child under 13, we will delete it immediately.',
    },
    {
      title: '12. Changes to This Privacy Policy',
      content: 'We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last Updated" date. Your continued use of the Service constitutes acceptance of the updated policy.',
    },
  ];

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-6">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Privacy Policy
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
                At ApkZio, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. Please read this policy carefully to understand our practices regarding your personal data.
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
              <h3 className="text-xl font-bold mb-4">Privacy Contact Information</h3>
              <p className="text-muted-foreground mb-6">
                If you have any questions or concerns about this Privacy Policy or our data practices, please contact our Privacy Team:
              </p>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-semibold">Email:</span>{' '}
                  <a href="mailto:privacy@apkzio.com" className="text-primary hover:underline">
                    privacy@apkzio.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
