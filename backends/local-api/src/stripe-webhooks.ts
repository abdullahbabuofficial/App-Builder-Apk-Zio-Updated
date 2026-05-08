import { stripe, STRIPE_WEBHOOK_SECRET } from './stripe-config.js';
import { BILLING_PLANS } from './billing-plans.js';
import { query } from './db.js';
import type { Request, Response } from 'express';

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!stripe) {
    res.status(503).send('Stripe is not configured');
    return;
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    res.status(400).send('Missing signature');
    return;
  }
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).send(`Webhook Error: ${err}`);
    return;
  }
  
  console.log(`Received webhook: ${event.type}`);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
    }
    
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).send('Webhook handler failed');
  }
}

async function handleCheckoutCompleted(session: any) {
  if (!stripe) return;

  const clientId = session.client_reference_id;
  const subscriptionId = session.subscription;
  
  if (!clientId || !subscriptionId) return;
  
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = stripeSub.items.data[0]?.price.id;
  
  const plan = BILLING_PLANS.find(p => 
    p.stripePriceIdMonthly === priceId || p.stripePriceIdYearly === priceId
  );
  
  if (!plan) return;
  
  await query(`
    INSERT INTO subscriptions (client_id, stripe_subscription_id, plan_name, status, amount, started_at)
    VALUES ($1, $2, $3, 'active', $4, NOW())
  `, [clientId, subscriptionId, plan.name, stripeSub.items.data[0]?.price.unit_amount]);
  
  await query(`
    UPDATE admin_clients 
    SET plan = $1, active_subscriptions = active_subscriptions + 1
    WHERE id = $2
  `, [plan.id, clientId]);
}

async function handleSubscriptionUpdated(subscription: any) {
  await query(`
    UPDATE subscriptions
    SET status = $1
    WHERE stripe_subscription_id = $2
  `, [subscription.status, subscription.id]);
}

async function handleSubscriptionDeleted(subscription: any) {
  await query(`
    UPDATE subscriptions
    SET status = 'cancelled', ends_at = NOW()
    WHERE stripe_subscription_id = $1
  `, [subscription.id]);
  
  const { rows } = await query(`
    SELECT client_id FROM subscriptions WHERE stripe_subscription_id = $1
  `, [subscription.id]);
  
  if (rows.length > 0) {
    await query(`
      UPDATE admin_clients
      SET active_subscriptions = GREATEST(0, active_subscriptions - 1)
      WHERE id = $1
    `, [rows[0].client_id]);
  }
}

async function handlePaymentSucceeded(invoice: any) {
  console.log(`Payment succeeded for invoice ${invoice.id}`);
  // Record in payments table if needed
}

async function handlePaymentFailed(invoice: any) {
  console.error(`Payment failed for invoice ${invoice.id}`);
  // Send notification to client
}
