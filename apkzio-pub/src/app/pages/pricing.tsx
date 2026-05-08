import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';

export function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: 'Starter',
      monthlyPrice: 9,
      yearlyPrice: 90,
      description: 'Perfect for individuals testing the waters',
      popular: false,
      features: [
        { name: '1 Android app', included: true },
        { name: 'Basic APK build', included: true },
        { name: 'Basic icon', included: true },
        { name: 'Basic splash screen', included: true },
        { name: '5 builds/month', included: true },
        { name: 'Email support', included: true },
        { name: 'AAB builds', included: false },
        { name: 'Push notifications', included: false },
        { name: 'AdMob integration', included: false },
        { name: 'Priority queue', included: false },
      ],
    },
    {
      name: 'Pro',
      monthlyPrice: 29,
      yearlyPrice: 290,
      description: 'Best for professionals and small businesses',
      popular: true,
      features: [
        { name: '1 Android app', included: true },
        { name: 'APK and AAB builds', included: true },
        { name: 'Custom icon', included: true },
        { name: 'Custom splash screen', included: true },
        { name: '30 builds/month', included: true },
        { name: 'Build history', included: true },
        { name: 'Priority queue', included: true },
        { name: 'Payment dashboard', included: true },
        { name: 'Email & chat support', included: true },
        { name: 'Push notifications', included: false },
      ],
    },
    {
      name: 'Business',
      monthlyPrice: 79,
      yearlyPrice: 790,
      description: 'For growing businesses with multiple apps',
      popular: false,
      features: [
        { name: '5 Android apps', included: true },
        { name: 'APK and AAB builds', included: true },
        { name: 'Push notification ready', included: true },
        { name: 'AdMob ready', included: true },
        { name: 'Advanced app settings', included: true },
        { name: '100 builds/month', included: true },
        { name: 'Invoice management', included: true },
        { name: 'Priority support', included: true },
        { name: 'Custom integrations', included: true },
        { name: 'Team access (3 users)', included: true },
      ],
    },
    {
      name: 'Enterprise',
      monthlyPrice: null,
      yearlyPrice: null,
      description: 'Custom solutions for large organizations',
      popular: false,
      features: [
        { name: 'Unlimited apps', included: true },
        { name: 'White-label support', included: true },
        { name: 'Team access (unlimited)', included: true },
        { name: 'Custom integrations', included: true },
        { name: 'Dedicated support', included: true },
        { name: 'SLA guarantee', included: true },
        { name: 'Custom contract', included: true },
        { name: 'Onboarding assistance', included: true },
        { name: 'Priority builds', included: true },
        { name: 'Advanced analytics', included: true },
      ],
    },
  ];

  const getPrice = (plan: typeof plans[0]) => {
    if (!plan.monthlyPrice) return 'Custom';
    const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
    return `$${price}`;
  };

  const getPeriod = () => (isYearly ? '/year' : '/month');

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Choose the plan that fits your needs. No hidden fees. Cancel anytime.
            </p>

            <div className="flex items-center justify-center gap-4">
              <span className={!isYearly ? 'font-semibold' : 'text-muted-foreground'}>Monthly</span>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <span className={isYearly ? 'font-semibold' : 'text-muted-foreground'}>
                Yearly
                <Badge className="ml-2 bg-success">Save 17%</Badge>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-2xl border p-8 hover:shadow-2xl transition-all duration-300 flex flex-col ${
                  plan.popular
                    ? 'border-primary shadow-xl scale-105 bg-gradient-to-br from-primary/5 to-secondary/5 relative'
                    : 'border-border bg-card'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary">
                    Most Popular
                  </Badge>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{getPrice(plan)}</span>
                    {plan.monthlyPrice && <span className="text-muted-foreground">{getPeriod()}</span>}
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-success shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <span className={feature.included ? '' : 'text-muted-foreground'}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={
                    plan.popular
                      ? 'w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90'
                      : 'w-full'
                  }
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  {plan.monthlyPrice ? `Choose ${plan.name}` : 'Contact Sales'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Feature Comparison</h2>

          <div className="max-w-6xl mx-auto overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-4 font-semibold">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold">Starter</th>
                  <th className="text-center py-4 px-4 font-semibold">Pro</th>
                  <th className="text-center py-4 px-4 font-semibold">Business</th>
                  <th className="text-center py-4 px-4 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-4 px-4">Android Apps</td>
                  <td className="text-center py-4 px-4">1</td>
                  <td className="text-center py-4 px-4">1</td>
                  <td className="text-center py-4 px-4">5</td>
                  <td className="text-center py-4 px-4">Unlimited</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-4 px-4">Builds per Month</td>
                  <td className="text-center py-4 px-4">5</td>
                  <td className="text-center py-4 px-4">30</td>
                  <td className="text-center py-4 px-4">100</td>
                  <td className="text-center py-4 px-4">Unlimited</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-4 px-4">AAB Support</td>
                  <td className="text-center py-4 px-4"><X className="h-5 w-5 text-muted-foreground mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-4 px-4">Push Notifications</td>
                  <td className="text-center py-4 px-4"><X className="h-5 w-5 text-muted-foreground mx-auto" /></td>
                  <td className="text-center py-4 px-4"><X className="h-5 w-5 text-muted-foreground mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="h-5 w-5 text-success mx-auto" /></td>
                  <td className="text-center py-4 px-4"><Check className="h-5 w-5 text-success mx-auto" /></td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-4 px-4">Support Level</td>
                  <td className="text-center py-4 px-4 text-sm">Email</td>
                  <td className="text-center py-4 px-4 text-sm">Email & Chat</td>
                  <td className="text-center py-4 px-4 text-sm">Priority</td>
                  <td className="text-center py-4 px-4 text-sm">Dedicated</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Still Have Questions?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Our team is here to help you find the perfect plan for your needs
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                Contact Sales
              </Button>
              <Button size="lg" variant="outline">
                View FAQ
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
