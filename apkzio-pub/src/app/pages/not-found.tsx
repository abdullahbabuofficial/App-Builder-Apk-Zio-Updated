import { ArrowRight, Compass, Hammer, Home, LifeBuoy } from 'lucide-react';
import { PageHero } from '../components/shared/page-hero';
import { Link } from '../components/router';

type NextStep = {
  to: string;
  icon: typeof Home;
  title: string;
  description: string;
};

const nextSteps: NextStep[] = [
  {
    to: '/',
    icon: Home,
    title: 'Back to home',
    description: 'Return to the ApkZio homepage and explore from a clean slate.',
  },
  {
    to: '/builders',
    icon: Hammer,
    title: 'Try the free builder',
    description: 'Turn any website into a branded Android app in a few minutes.',
  },
  {
    to: '/contact',
    icon: LifeBuoy,
    title: 'Talk to support',
    description: 'Tell us what you were trying to find and we will point you in the right direction.',
  },
];

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background">
      <PageHero
        eyebrow="404"
        title="Page not found"
        description="The page you're looking for either moved or never existed. Pick a path below to keep going."
        icon={Compass}
        size="lg"
      />

      <main className="mx-auto -mt-8 max-w-5xl px-4 pb-20 lg:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nextSteps.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.to}
                to={step.to}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Go there
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          If you reached this from a saved link, the URL may have been updated. The
          builder, dashboard, and marketing pages are all still here.
        </p>
      </main>
    </div>
  );
}
