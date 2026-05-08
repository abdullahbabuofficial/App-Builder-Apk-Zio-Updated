# Stripe Billing Integration - Quick Start

## What was implemented

✅ Stripe SDK integration (`stripe` + `@stripe/stripe-js`)
✅ Billing plans configuration (Starter, Pro, Business)
✅ Subscription management API
✅ Stripe webhook handler for payment events
✅ Frontend billing UI in Settings page
✅ Database schema (subscriptions table already exists)
✅ Environment variable documentation

## Files created/modified

### Backend
- `backends/local-api/src/stripe-config.ts` - Stripe client initialization
- `backends/local-api/src/billing-plans.ts` - Plan definitions
- `backends/local-api/src/billing-api.ts` - Subscription CRUD operations
- `backends/local-api/src/stripe-webhooks.ts` - Webhook event handlers
- `backends/local-api/src/server.ts` - Added billing API routes
- `backends/local-api/STRIPE_SETUP.md` - Complete setup guide
- `backends/local-api/.env.example` - Environment variables template

### Frontend
- `apkzio-admin/src/pages/Settings.tsx` - Added billing UI

### Database
- Migration `004_webhooks_billing.sql` already includes subscriptions table

## Quick test (without Stripe setup)

The integration gracefully handles missing Stripe credentials:

1. Start backend:
   ```bash
   cd backends/local-api
   npm run dev
   ```

2. Start frontend:
   ```bash
   cd apkzio-admin
   npm run dev
   ```

3. Visit http://localhost:5173/settings → Billing tab

You'll see the billing UI with plans, but checkout will fail without Stripe keys.

## Full setup with Stripe

Follow the detailed guide: `backends/local-api/STRIPE_SETUP.md`

**Quick steps:**

1. Create Stripe account at https://stripe.com
2. Create products & prices in Stripe Dashboard
3. Add environment variables to `backends/local-api/.env`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   STRIPE_PRICE_PRO_MONTHLY=price_xxxxx
   STRIPE_PRICE_PRO_YEARLY=price_xxxxx
   STRIPE_PRICE_BUSINESS_MONTHLY=price_xxxxx
   STRIPE_PRICE_BUSINESS_YEARLY=price_xxxxx
   ADMIN_URL=http://localhost:5173
   ```
4. Set up webhook forwarding (for local dev):
   ```bash
   stripe listen --forward-to localhost:8787/api/webhooks/stripe
   ```
5. Test checkout with card: 4242 4242 4242 4242

## API Endpoints

### GET /api/billing/plans
Returns all available billing plans

### POST /api/billing/checkout
Body: `{ client_id, plan_id, interval }`
Returns: Stripe checkout URL

### GET /api/billing/subscription/:clientId
Returns: Current subscription details

### POST /api/billing/cancel
Body: `{ subscription_id }`
Cancels subscription at period end

### POST /api/webhooks/stripe
Handles Stripe webhook events (requires raw body)

## Testing checklist

- [ ] Plans display in Settings → Billing
- [ ] Click upgrade redirects to Stripe Checkout
- [ ] Complete checkout with test card 4242 4242 4242 4242
- [ ] Webhook processes checkout.session.completed
- [ ] Subscription appears in Settings → Billing
- [ ] Current plan badge shows on active plan
- [ ] Cancel subscription works
- [ ] Subscription status updates to "canceling"

## Troubleshooting

### "Stripe is not configured" error
- Add `STRIPE_SECRET_KEY` to `.env`
- Restart backend

### Checkout page doesn't load
- Verify price IDs in `.env` match Stripe Dashboard
- Check backend logs for errors

### Webhook not working
- Run `stripe listen --forward-to localhost:8787/api/webhooks/stripe`
- Copy webhook secret to `STRIPE_WEBHOOK_SECRET`
- Check webhook events in Stripe Dashboard

## Next steps

1. Set up Stripe products in test mode
2. Configure webhook forwarding
3. Test complete checkout flow
4. Deploy to production with live keys
5. Monitor subscriptions in Stripe Dashboard
