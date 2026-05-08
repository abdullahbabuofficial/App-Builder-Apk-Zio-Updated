import { Mail, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link } from '../components/router';

export function BlogPage() {
  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Blog & Resources
            </h1>
            <p className="text-lg text-muted-foreground">
              Guides, walkthroughs and product updates for ApkZio builders.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Coming soon</h2>
              <p className="text-muted-foreground mb-8">
                We're putting together step-by-step guides on shipping your first APK,
                wiring up push notifications and publishing to the Play Store.
                In the meantime, the builder is ready when you are.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/builders">
                  <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                    Try the free builder
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button variant="outline">
                    <Mail className="mr-2 h-4 w-4" />
                    Suggest a topic
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
