import { Mail, BookOpen, MessageSquare, Search, Send, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

export function SupportPage() {
  const faqs = [
    { q: 'How long does a build take?', a: 'Most APK builds finish in 3-5 minutes depending on website complexity.' },
    { q: 'Can I update my app after publishing?', a: 'Yes — you can rebuild and redistribute updated versions anytime.' },
    { q: 'Do you support push notifications?', a: 'Yes, via Firebase Cloud Messaging on Pro plans and above.' },
    { q: 'What is the difference between APK and AAB?', a: 'APK is for direct install, AAB is required for the Play Store.' },
  ];

  return (
    <DashboardLayout currentPage="support">
      <div className="space-y-6">
        <div>
          <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Help & Support</h1>
          <p className="text-muted-foreground mt-1">Find answers or get in touch with our team</p>
        </div>

        {/* Search */}
        <div className="bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border border-primary/20 rounded-2xl p-8 text-center">
          <h2>How can we help you?</h2>
          <div className="relative max-w-xl mx-auto mt-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Search articles, guides, FAQs..." className="pl-12 h-12 text-base" />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: BookOpen, label: 'Documentation', desc: 'Setup guides and how-tos', color: 'from-primary to-secondary' },
            { icon: MessageSquare, label: 'Submit a ticket', desc: 'Use the form below', color: 'from-secondary to-accent' },
            { icon: Mail, label: 'Email support', desc: 'support@apkzio.com', color: 'from-accent to-primary' },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} className="bg-card border border-border rounded-2xl p-5 text-left hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center mb-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <p className="font-medium">{a.label}</p>
                <p className="text-sm text-muted-foreground mt-1">{a.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* FAQs */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="mb-4">Frequently Asked Questions</h3>
            <div className="space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="group rounded-xl bg-muted/30 p-4 cursor-pointer">
                  <summary className="flex items-center justify-between font-medium">
                    {f.q}
                    <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
                  </summary>
                  <p className="text-sm text-muted-foreground mt-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="mb-4">Submit a Ticket</h3>
            <div className="space-y-4">
              <Input placeholder="Subject" />
              <select className="w-full px-3 py-2 rounded-lg border border-border bg-background">
                <option>General Inquiry</option>
                <option>Technical Issue</option>
                <option>Billing Question</option>
                <option>Feature Request</option>
              </select>
              <Textarea placeholder="Describe your issue..." rows={5} />
              <Button className="w-full bg-gradient-to-r from-primary to-secondary">
                <Send className="mr-2 h-4 w-4" />Send Message
              </Button>
            </div>
          </div>
        </div>

        {/* Tickets */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="mb-2 font-semibold">My Tickets</h3>
          <p className="text-sm text-muted-foreground">
            You haven't opened any tickets yet. Submit one above and we'll reply via
            email — your conversation history will appear here once ticketing is wired up.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
