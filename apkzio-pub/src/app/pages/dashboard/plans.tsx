import { Check, Sparkles, Zap, Crown, Rocket } from 'lucide-react';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../contexts/auth-context';
import { Link } from '../../components/router';

type Plan = {
  name: string;
  price: number | null;
  icon: typeof Sparkles;
  gradient: string;
  popular?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    name: 'Starter',
    price: 9,
    icon: Sparkles,
    gradient: 'from-blue-400 to-cyan-400',
    features: [
      '1 Android app',
      '5 builds / month',
      'APK build',
      'Basic icon & splash',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: 29,
    icon: Zap,
    gradient: 'from-primary to-secondary',
    popular: true,
    features: [
      '1 Android app',
      '30 builds / month',
      'APK + AAB output',
      'Custom icon & splash',
      'Build history',
      'Priority queue',
    ],
  },
  {
    name: 'Business',
    price: 79,
    icon: Crown,
    gradient: 'from-secondary to-accent',
    features: [
      '5 Android apps',
      '100 builds / month',
      'APK + AAB output',
      'Push notifications',
      'AdMob ready',
      'Invoice management',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: null,
    icon: Rocket,
    gradient: 'from-accent to-pink-400',
    features: [
      'Unlimited apps',
      'Unlimited builds',
      'White-label support',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
    ],
  },
];

export function PlansPage() {
  const { user } = useAuth();
  const currentPlan = user?.plan?.toLowerCase() ?? null;

  return (
    <DashboardLayout currentPage="plans">
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">Choose Your Plan</h1>
          <p className="text-muted-foreground mt-2">
            Upgrade or downgrade anytime. Pricing matches our public pricing page.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.name.toLowerCase();
            return (
              <div
                key={plan.name}
                className={`relative bg-card border-2 rounded-2xl p-6 transition-all hover:shadow-xl ${
                  plan.popular ? 'border-primary shadow-lg scale-105' : 'border-border'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary">
                    Most Popular
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="absolute -top-3 right-4 bg-success">Current</Badge>
                )}
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-4`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-4">
                  {plan.price == null ? (
                    <span className="text-3xl font-bold">Custom</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">${plan.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </>
                  )}
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full mt-6 ${
                    isCurrent ? '' : `bg-gradient-to-r ${plan.gradient} hover:opacity-90`
                  }`}
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : plan.price == null
                      ? 'Contact sales'
                      : 'Upgrade'}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 border border-border rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-semibold">Need a custom plan?</h2>
          <p className="text-muted-foreground mt-2">
            Contact us for volume pricing, custom integrations or a tailored SLA.
          </p>
          <Link to="/contact">
            <Button className="mt-4 bg-gradient-to-r from-primary to-secondary">Contact Sales</Button>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
