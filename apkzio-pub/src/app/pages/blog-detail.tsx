import { ArrowLeft, FileText, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Link } from '../components/router';

export function BlogDetailPage() {
  return (
    <div className="min-h-screen">
      <section className="py-12 border-b border-border">
        <div className="container mx-auto px-4">
          <Link to="/blog">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-3">Article not yet published</h1>
              <p className="text-muted-foreground mb-8">
                The blog is launching soon. Until then, head to the builder to start your
                first Android app or browse what ApkZio can do today.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/builders">
                  <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                    Try the free builder
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/products">
                  <Button variant="outline">View product features</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
