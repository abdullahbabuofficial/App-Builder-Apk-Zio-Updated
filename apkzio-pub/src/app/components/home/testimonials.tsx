import { Sparkles, Hammer, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Link } from '../router';

export function Testimonials() {
  const reasons = [
    {
      title: 'Built around your site',
      description:
        'ApkZio wraps your existing website into a native Android shell so the content you already maintain becomes the app.',
    },
    {
      title: 'No SDK plumbing',
      description:
        'Push, deep links, splash screens and icons are wired up for you — paste a URL, pick a brand, ship the APK.',
    },
    {
      title: 'You own the build',
      description:
        'Every build downloads as a real APK or AAB you can sign, install and publish to the Play Store yourself.',
    },
  ];

  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Be one of the first</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            A simpler way to ship Android apps
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            ApkZio is built for site owners and indie developers who want a real Android app without
            spinning up a Gradle project. Try it free and tell us what you'd like to see next.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {reasons.map((item, index) => (
            <div
              key={index}
              className="rounded-2xl bg-background/50 backdrop-blur border border-border p-8 hover:shadow-xl transition-all duration-300"
            >
              <h3 className="font-semibold text-lg mb-3">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/builders">
            <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
              <Hammer className="mr-2 h-5 w-5" />
              Try the free builder
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link to="/contact">
            <Button size="lg" variant="outline">
              Share feedback
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
