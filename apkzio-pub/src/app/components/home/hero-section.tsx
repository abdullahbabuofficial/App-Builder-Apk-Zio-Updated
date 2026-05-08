import { ArrowRight, Sparkles, Shield, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Link } from '../router';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-[linear-gradient(180deg,hsl(var(--background))_0%,rgba(20,184,166,0.08)_100%)] py-20 md:py-32">

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">No code required</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Convert Your Website Into an Android App in Seconds
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            ApkZio helps businesses, creators, and site owners turn any website into a downloadable Android APK/AAB with custom branding and push-ready subscribers.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <div className="flex gap-2 max-w-md mx-auto sm:mx-0">
              <Input
                type="url"
                placeholder="https://yourwebsite.com"
                className="bg-background/50 backdrop-blur"
              />
              <Link to="/builders">
                <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 whitespace-nowrap">
                  Build APK
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/builders">
              <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Build Your APK
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/pricing"><Button size="lg" variant="outline">View Pricing</Button></Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-card/50 backdrop-blur border border-border p-4 shadow-lg hover:shadow-xl transition-shadow">
              <CheckCircle2 className="h-8 w-8 text-success mb-2 mx-auto" />
              <p className="text-sm font-medium">APK Ready</p>
            </div>
            <div className="rounded-2xl bg-card/50 backdrop-blur border border-border p-4 shadow-lg hover:shadow-xl transition-shadow">
              <Sparkles className="h-8 w-8 text-primary mb-2 mx-auto" />
              <p className="text-sm font-medium">Build Complete</p>
            </div>
            <div className="rounded-2xl bg-card/50 backdrop-blur border border-border p-4 shadow-lg hover:shadow-xl transition-shadow">
              <Shield className="h-8 w-8 text-secondary mb-2 mx-auto" />
              <p className="text-sm font-medium">No Code Needed</p>
            </div>
            <div className="rounded-2xl bg-card/50 backdrop-blur border border-border p-4 shadow-lg hover:shadow-xl transition-shadow">
              <Clock className="h-8 w-8 text-accent mb-2 mx-auto" />
              <p className="text-sm font-medium">Secure Payment</p>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
