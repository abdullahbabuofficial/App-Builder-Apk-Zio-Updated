# Stripe Billing Integration

This guide walks you through setting up Stripe billing for ApkZio.

## Prerequisites

- A Stripe account (create one at https://stripe.com)
- ApkZio backend running (`npm run dev` in `backends/local-api`)
- ApkZio admin dashboard running (`npm run dev` in `apkzio-admin`)

## Setup Steps

### 1. Create Stripe Products & Prices

Log into your [Stripe Dashboard](https://dashboard.stripe.com) and create products:

#### Pro Plan
- **Product Name**: Pro Plan
- **Monthly Price**: $49/month
- **Yearly Price**: $490/year (save 16%)
- Note the price IDs (format: `price_xxxxx`)

#### Business Plan
- **Product Name**: Business Plan
- **Monthly Price**: $199/month
- **Yearly Price**: $1990/year (save 16%)
- Note the price IDs

### 2. Configure Environment Variables

Add the following to `backends/local-api/.env`:

```bash
# Stripe API Keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Stripe Price IDs (get from https://dashboard.stripe.com/products)
STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_PRO_YEARLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_BUSINESS_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_BUSINESS_YEARLY=price_xxxxxxxxxxxxx

# Admin dashboard URL (for redirect after checkout)
ADMIN_URL=http://localhost:5173
```

**Finding your keys:**
- **Secret Key**: [API Keys page](https://dashboard.stripe.com/test/apikeys)
- **Price IDs**: [Products page](https://dashboard.stripe.com/test/products) → Click product → Copy price ID

### 3. Set Up Webhook Endpoint

Stripe needs to notify your server about subscription events.

#### Local Development (with Stripe CLI)

1. Install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe  # macOS
   # or download from https://stripe.com/docs/stripe-cli
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:8787/api/webhooks/stripe
   ```

4. Copy the webhook signing secret (starts with `whsec_`) and add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

#### Production Deployment

1. Go to [Webhooks page](https://dashboard.stripe.com/test/webhooks)
2. Click **"Add endpoint"**
3. Set endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret and update your production environment

### 4. Run Database Migrations

Ensure the `subscriptions` table exists:

```bash
cd backends/local-api
npm run migrate
```

### 5. Test the Integration

1. Start the backend:
   ```bash
   cd backends/local-api
   npm run dev
   ```

2. Start the admin dashboard:
   ```bash
   cd apkzio-admin
   npm run dev
   ```

3. Open http://localhost:5173/settings
4. Navigate to the **Billing** tab
5. Try upgrading to a paid plan
6. Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC

### 6. Verify Webhooks

In the Stripe CLI terminal, you should see webhook events:

```
webhook_event.created
  checkout.session.completed
  customer.subscription.created
```

Check your backend logs for:
```
Received webhook: checkout.session.completed
```

## API Endpoints

### Get Available Plans
```bash
GET /api/billing/plans
```

### Create Checkout Session
```bash
POST /api/billing/checkout
Content-Type: application/json

{
  "client_id": "user-uuid",
  "plan_id": "pro",
  "interval": "monthly"
}
```

### Get Subscription Details
```bash
GET /api/billing/subscription/:clientId
```

### Cancel Subscription
```bash
POST /api/billing/cancel
Content-Type: application/json

{
  "subscription_id": "sub_xxxxxxxxxxxxx"
}
```

### Webhook Endpoint
```bash
POST /api/webhooks/stripe
Content-Type: application/json
Stripe-Signature: t=xxx,v1=xxx

# Stripe sends this automatically
```

## Testing

### Test Cards

Use these test cards in Stripe Checkout:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient funds**: `4000 0000 0000 9995`
- **3D Secure**: `4000 0025 0000 3155`

### Test Webhook Events

Trigger test events using Stripe CLI:

```bash
# Test successful checkout
stripe trigger checkout.session.completed

# Test subscription update
stripe trigger customer.subscription.updated

# Test subscription cancellation
stripe trigger customer.subscription.deleted
```

## Troubleshooting

### Webhook signature verification fails

- Ensure `STRIPE_WEBHOOK_SECRET` is set correctly
- For local dev, make sure `stripe listen` is running
- Check that the raw body is being passed to the webhook handler

### Checkout redirects but subscription not created

- Check webhook events in Stripe dashboard
- Verify webhook endpoint is accessible
- Check backend logs for webhook processing errors

### Plans not showing in dashboard

- Verify price IDs are set in `.env`
- Check that backend is reading environment variables
- Restart the backend server after adding new env vars

## Going Live

Before launching to production:

1. Switch from test keys to live keys in production environment
2. Create live products and prices in Stripe dashboard
3. Update webhook endpoint to production URL
4. Test with real payment methods
5. Set up proper error monitoring (e.g., Sentry)
6. Configure invoice emails in Stripe settings

## Security Notes

- Never commit `.env` files with real keys to git
- Use environment variables for all secrets
- Enable webhook signature verification (already implemented)
- Use HTTPS in production for webhook endpoints
- Regularly rotate API keys

## Support

For issues:
- Stripe documentation: https://stripe.com/docs
- Stripe support: https://support.stripe.com
- ApkZio issues: Open a GitHub issue
