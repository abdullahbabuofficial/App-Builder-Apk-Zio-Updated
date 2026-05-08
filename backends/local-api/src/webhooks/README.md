# ApkZio Webhook System

The webhook system provides real-time HTTP callbacks for events that occur in your ApkZio instance.

## Features

- **Reliable delivery**: Failed deliveries are automatically retried with exponential backoff
- **Signature verification**: All webhook requests include HMAC SHA256 signatures for security
- **Event filtering**: Subscribe only to the events you care about
- **Delivery logs**: Track every webhook delivery attempt

## Available Events

- `campaign.sent` - Triggered when a campaign finishes sending
- `campaign.delivered` - Triggered when a message is delivered to a device
- `campaign.opened` - Triggered when a user opens a notification
- `campaign.clicked` - Triggered when a user clicks a notification
- `campaign.failed` - Triggered when a campaign fails
- `app.created` - Triggered when a new app is created
- `build.completed` - Triggered when a build finishes successfully
- `build.failed` - Triggered when a build fails

## Creating a Webhook Endpoint

### Via API

```bash
curl -X POST http://localhost:8787/api/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Apkzio-Admin-Key: YOUR_ADMIN_KEY" \
  -d '{
    "url": "https://api.example.com/webhooks",
    "events": ["campaign.sent", "campaign.failed"]
  }'
```

Response:
```json
{
  "ok": true,
  "webhook": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://api.example.com/webhooks",
    "secret": "a1b2c3d4...",
    "events": ["campaign.sent", "campaign.failed"],
    "is_active": true,
    "created_at": "2026-05-08T10:00:00Z"
  }
}
```

### Via Admin UI

1. Navigate to Settings → Webhooks
2. Click "Add webhook"
3. Enter your webhook URL
4. Select the events you want to receive
5. Click "Create webhook"

## Webhook Payload Format

All webhooks are sent as POST requests with a JSON payload:

```json
{
  "id": "unique-webhook-delivery-id",
  "event": "campaign.sent",
  "created_at": "2026-05-08T10:00:00Z",
  "data": {
    "campaign_id": "550e8400-e29b-41d4-a716-446655440000",
    "app_id": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Welcome to ApkZio",
    "recipients_count": 1500,
    "sent_at": "2026-05-08T10:00:00Z"
  }
}
```

## Request Headers

Every webhook request includes the following headers:

- `Content-Type: application/json`
- `X-Webhook-Signature`: HMAC SHA256 signature of the payload
- `X-Webhook-ID`: Unique ID for this delivery attempt
- `X-Webhook-Event`: The event type (e.g., "campaign.sent")

## Signature Verification

To verify webhook authenticity, compute the HMAC SHA256 signature and compare it with the `X-Webhook-Signature` header:

### Node.js Example

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const computed = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  );
}

// Express middleware
app.post('/webhooks', express.json(), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  
  if (!verifyWebhook(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  console.log('Received webhook:', req.body);
  res.json({ ok: true });
});
```

### Python Example

```python
import hmac
import hashlib
import json

def verify_webhook(payload, signature, secret):
    computed = hmac.new(
        secret.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, computed)

# Flask example
@app.route('/webhooks', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    secret = os.environ['WEBHOOK_SECRET']
    
    if not verify_webhook(request.json, signature, secret):
        return {'error': 'Invalid signature'}, 401
    
    # Process webhook
    print('Received webhook:', request.json)
    return {'ok': True}
```

## Retry Logic

If a webhook delivery fails, ApkZio will automatically retry with exponential backoff:

- **Attempt 1**: Immediate (0s delay)
- **Attempt 2**: 2s delay
- **Attempt 3**: 4s delay
- **Attempt 4**: 8s delay
- **Attempt 5**: 16s delay (final attempt)

Webhooks are considered failed if:
- The endpoint returns a non-2xx status code
- The request times out (10 seconds)
- A network error occurs

Failed webhooks are automatically removed after 24 hours.

## Best Practices

1. **Always verify signatures** - Never trust webhook data without signature verification
2. **Return 2xx quickly** - Respond within 10 seconds to avoid timeouts
3. **Process asynchronously** - Queue webhook processing for long-running tasks
4. **Handle duplicates** - Use the webhook ID to detect duplicate deliveries
5. **Monitor failures** - Check the delivery logs in the admin UI regularly

## Troubleshooting

### Webhooks not being delivered

1. Check that the endpoint is active (Settings → Webhooks)
2. Verify the URL is publicly accessible (no localhost/private IPs)
3. Check the delivery logs for error messages
4. Ensure your server responds with 2xx status codes
5. Verify your server accepts POST requests

### Signature verification failing

1. Make sure you're using the correct secret from the webhook configuration
2. Verify you're computing the HMAC over the raw JSON string (not a parsed object)
3. Check that you're using SHA256 (not SHA1 or MD5)
4. Ensure you're comparing the signatures with a constant-time comparison

### Duplicate webhooks

This is expected behavior during retries. Use the `X-Webhook-ID` header to deduplicate events in your application.

## API Reference

### List Webhooks

```
GET /api/webhooks
```

Returns all webhook endpoints.

### Create Webhook

```
POST /api/webhooks
```

Body:
```json
{
  "url": "https://api.example.com/webhooks",
  "events": ["campaign.sent", "campaign.failed"]
}
```

### Update Webhook

```
PATCH /api/webhooks/:id
```

Body:
```json
{
  "is_active": false
}
```

### Delete Webhook

```
DELETE /api/webhooks/:id
```

### List Deliveries

```
GET /api/webhooks/:id/deliveries
```

Returns the last 100 delivery attempts for a webhook.
