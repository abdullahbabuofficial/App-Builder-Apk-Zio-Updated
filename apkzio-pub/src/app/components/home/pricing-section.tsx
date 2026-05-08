import { Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function PricingSection() {
  const plans = [
    {
      name: 'Starter',
      price: 9,
      popular: false,
      features: [
        '1 Android app',
        'Basic APK build',
        'Basic icon',
        'Basic splash screen',
        '5 builds/month',
        'Email support',
      ],
    },
    {
      name: 'Pro',
      price: 29,
      popular: true,
      features: [
        '1 Android app',
        'APK and AAB builds',
        'Custom icon',
        'Custom splash screen',
        '30 builds/month',
        'Build history',
        'Priority queue',
        'Payment dashboard',
      ],
    },
    {
      name: 'Business',
      price: 79,
      popular: false,
      features: [
        '5 Android apps',
        'APK and AAB builds',
        'Push notification ready',
        'AdMob ready',
        'Advanced app settings',
        '100 builds/month',
        'Invoice management',
        'Priority support',
      ],
    },
  ];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs. No hidden fees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`rounded-2xl border p-8 hover:shadow-2xl transition-all duration-300 ${
                plan.popular
                  ? 'border-primary shadow-xl scale-105 bg-gradient-to-br from-primary/5 to-secondary/5'
                  : 'border-border bg-card'
              }`}
            >
              {plan.popular && (
                <Badge className="mb-4 bg-gradient-to-r from-primary to-secondary">
                  Most Popular
                </Badge>
              )}
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-success" />
                    <span className="text-sm">{feature}</span>
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
                Choose {plan.name}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
