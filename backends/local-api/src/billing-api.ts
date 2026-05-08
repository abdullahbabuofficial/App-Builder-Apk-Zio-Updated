import { stripe } from './stripe-config.js';
import { BILLING_PLANS } from './billing-plans.js';
import { query } from './db.js';

export async function createCheckoutSession(
  clientId: string,
  planId: string,
  interval: 'monthly' | 'yearly'
): Promise<string> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  const plan = BILLING_PLANS.find(p => p.id === planId);
  if (!plan) throw new Error('Invalid plan');
  
  const priceId = interval === 'monthly' ? plan.stripePriceIdMonthly : plan.stripePriceIdYearly;
  if (!priceId) throw new Error('Price not configured');
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    success_url: `${process.env.ADMIN_URL || 'http://localhost:5173'}/settings?billing=success`,
    cancel_url: `${process.env.ADMIN_URL || 'http://localhost:5173'}/settings?billing=cancelled`,
    client_reference_id: clientId,
  });
  
  return session.url!;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  
  await query(`
    UPDATE subscriptions 
    SET status = 'canceling'
    WHERE stripe_subscription_id = $1
  `, [subscriptionId]);
}

export async function getSubscriptionDetails(clientId: string) {
  const { rows } = await query(`
    SELECT * FROM subscriptions
    WHERE client_id = $1 AND status IN ('active', 'canceling')
    ORDER BY started_at DESC
    LIMIT 1
  `, [clientId]);
  
  if (rows.length === 0) return null;
  
  const sub = rows[0];
  if (sub.stripe_subscription_id && stripe) {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    return { ...sub, stripe: stripeSub };
  }
  
  return sub;
}
