import { Target, Shield, Zap, Users, Award, Rocket } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link } from '../components/router';

export function AboutPage() {
  const values = [
    {
      icon: Target,
      title: 'Our Mission',
      description:
        'Make publishing an Android app as simple as launching a website — no Gradle, no Java, no SDK juggling.',
    },
    {
      icon: Shield,
      title: 'Security First',
      description:
        'We treat your site, signing keys and subscriber tokens with care. Builds are scoped to your account and your domain.',
    },
    {
      icon: Zap,
      title: 'Fast Iteration',
      description:
        'Tweak a colour, swap an icon, rebuild. Every change is a one-click rebuild — no CI pipeline required.',
    },
    {
      icon: Users,
      title: 'Built With Builders',
      description:
        'ApkZio is shaped by feedback from the indie developers, agencies and site owners who use it. Tell us what to ship next.',
    },
  ];

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              We Make Android App Creation Simple
            </h1>
            <p className="text-lg text-muted-foreground">
              ApkZio turns the website you already maintain into a real Android app —
              with custom branding, push notifications and Play Store-ready output —
              without asking you to learn a new build system.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {values.map((value, index) => (
              <div
                key={index}
                className="rounded-2xl bg-card border border-border p-8 hover:shadow-xl transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4">
                  <value.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Why ApkZio Exists
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Most teams that need an Android app already have a perfectly good website.
              ApkZio bridges that gap so you can ship the app version of your site without
              rebuilding what already works.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <Award className="h-16 w-16 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">For Site Owners</h3>
              <p className="text-muted-foreground">
                Reach mobile users with a real Android app — no developer, no rewrites,
                no months of work.
              </p>
            </div>
            <div className="text-center">
              <Rocket className="h-16 w-16 text-secondary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No-Code Builder</h3>
              <p className="text-muted-foreground">
                Paste a URL, customize the brand, generate a signed APK or AAB you can
                publish anywhere.
              </p>
            </div>
            <div className="text-center">
              <Shield className="h-16 w-16 text-accent mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Built for Production</h3>
              <p className="text-muted-foreground">
                Push notifications, deep links and analytics-ready hooks ship with every
                build, not as paid add-ons.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Start Your Journey?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Sign up and ship the Android version of your site today.
            </p>
            <Link to="/register">
              <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Get Started Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
