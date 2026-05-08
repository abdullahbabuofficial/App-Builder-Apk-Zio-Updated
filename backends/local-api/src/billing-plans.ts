export interface BillingPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  features: string[];
  limits: {
    apps: number;
    campaigns: number;
    buildMinutes: number;
  };
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 0,
    priceYearly: 0,
    stripePriceIdMonthly: '',
    stripePriceIdYearly: '',
    features: ['1 app', '100 campaigns/month', '10 build minutes/month'],
    limits: { apps: 1, campaigns: 100, buildMinutes: 10 },
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    priceYearly: 490,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    features: ['5 apps', 'Unlimited campaigns', '100 build minutes/month'],
    limits: { apps: 5, campaigns: -1, buildMinutes: 100 },
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 199,
    priceYearly: 1990,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '',
    stripePriceIdYearly: process.env.STRIPE_PRICE_BUSINESS_YEARLY || '',
    features: ['Unlimited apps', 'Unlimited campaigns', 'Unlimited builds', 'Priority support'],
    limits: { apps: -1, campaigns: -1, buildMinutes: -1 },
  },
];
