/**
 * Simple webhook test server for local testing
 * 
 * Usage:
 *   tsx src/webhooks/test-webhook-server.ts
 * 
 * Then configure a webhook in ApkZio admin:
 *   URL: http://localhost:9999/webhook
 *   Events: campaign.sent, app.created
 */

import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const SECRET = process.env.WEBHOOK_SECRET || 'test-secret';

function verifySignature(payload: any, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const computed = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  );
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const webhookId = req.headers['x-webhook-id'] as string;
  const event = req.headers['x-webhook-event'] as string;
  
  console.log('\n📨 Received webhook:');
  console.log('  ID:', webhookId);
  console.log('  Event:', event);
  console.log('  Signature:', signature?.slice(0, 16) + '...');
  console.log('  Payload:', JSON.stringify(req.body, null, 2));
  
  // Verify signature
  if (!verifySignature(req.body, signature, SECRET)) {
    console.log('❌ Invalid signature!');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  console.log('✅ Signature verified!');
  
  // Simulate processing
  setTimeout(() => {
    console.log('✅ Webhook processed successfully');
  }, 100);
  
  return res.json({ ok: true, received: true });
});

const PORT = 9999;
app.listen(PORT, () => {
  console.log(`🎯 Test webhook server listening on http://localhost:${PORT}`);
  console.log(`📝 Secret: ${SECRET}`);
  console.log(`\n💡 Configure your webhook:`);
  console.log(`   URL: http://localhost:${PORT}/webhook`);
  console.log(`   Events: campaign.sent, app.created, etc.`);
  console.log(`\n🔐 To set a custom secret:`);
  console.log(`   WEBHOOK_SECRET=your-secret tsx src/webhooks/test-webhook-server.ts`);
});
