import { Mail, Clock, CreditCard, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Link } from '../components/router';

export function ContactPage() {
  const contactMethods = [
    {
      icon: Mail,
      title: 'Sales',
      description: 'Questions about pricing or plans?',
      contact: 'sales@apkzio.com',
      available: 'We reply within 1 business day',
    },
    {
      icon: HelpCircle,
      title: 'Support',
      description: 'Need help with a build or your app?',
      contact: 'support@apkzio.com',
      available: 'Replies on weekdays',
    },
    {
      icon: CreditCard,
      title: 'Billing',
      description: 'Payment or subscription issues?',
      contact: 'billing@apkzio.com',
      available: 'Replies on weekdays',
    },
  ];

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Get in Touch
            </h1>
            <p className="text-lg text-muted-foreground">
              Have questions? We're here to help. Reach out through any of the channels below.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto">
            {contactMethods.map((method, index) => (
              <div
                key={index}
                className="rounded-2xl bg-card border border-border p-6 hover:shadow-xl transition-all duration-300 text-center"
              >
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4">
                  <method.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-semibold mb-2">{method.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">{method.description}</p>
                <p className="text-sm font-medium text-primary mb-2">
                  <a href={`mailto:${method.contact}`} className="hover:underline">
                    {method.contact}
                  </a>
                </p>
                <p className="text-xs text-muted-foreground">{method.available}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            <div>
              <h2 className="text-3xl font-bold mb-6">Send Us a Message</h2>
              <form className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Name</label>
                    <Input placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <Input type="email" placeholder="john@example.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Subject</label>
                  <Input placeholder="How can we help?" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Inquiry Type</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales</SelectItem>
                      <SelectItem value="support">Technical Support</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="partnership">Partnership</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <Textarea
                    placeholder="Tell us more about your question..."
                    rows={6}
                  />
                </div>

                <Button size="lg" className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                  Send Message
                </Button>
              </form>
            </div>

            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold mb-6">Other Ways to Reach Us</h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Email</h3>
                      <p className="text-sm text-muted-foreground">
                        <a href="mailto:hello@apkzio.com" className="hover:underline text-primary">
                          hello@apkzio.com
                        </a>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Best for general questions and partnerships.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Response Time</h3>
                      <p className="text-sm text-muted-foreground">
                        We aim to reply to every email within one business day.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Higher-priority routes for paying customers come with their plan.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-border p-6">
                <h3 className="font-semibold mb-2">Want to see ApkZio in action?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try the free builder — no signup required to preview a build.
                </p>
                <Link to="/builders">
                  <Button variant="outline" className="w-full">
                    Open the builder
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
