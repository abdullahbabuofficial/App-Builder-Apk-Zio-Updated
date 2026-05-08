import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Link } from '../router';

export function CTASection() {
  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-muted/20" />

      <div className="container relative mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Get started for free</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Ready to Launch Your Android App?
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Build the first version free, then connect push subscribers and live visitor tracking as your site grows.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/builders">
              <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Start Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/products"><Button size="lg" variant="outline">View Features</Button></Link>
          </div>

          <div className="mt-12 pt-12 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Free first build · Sign in to save apps and rebuild anytime
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
