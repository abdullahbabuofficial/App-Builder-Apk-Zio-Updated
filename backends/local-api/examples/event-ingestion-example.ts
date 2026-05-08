/**
 * Event Ingestion API Usage Example
 * 
 * This example demonstrates how to send analytics events to the ApkZio API.
 */

// Single event ingestion
async function sendSingleEvent() {
  const response = await fetch('http://localhost:8787/sdk/event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: 'your-app-uuid',
      event_type: 'install',
      device_id: 'device-123',
      country_code: 'US',
      event_data: {
        source: 'play_store',
        campaign: 'summer_2026',
      },
      timestamp: new Date().toISOString(),
    }),
  });

  const result = await response.json();
  console.log('Single event result:', result);
  // { ok: true, accepted: 1, rejected: 0 }
}

// Batch event ingestion
async function sendBatchEvents() {
  const events = [
    {
      app_id: 'your-app-uuid',
      event_type: 'install',
      device_id: 'device-123',
      country_code: 'US',
    },
    {
      app_id: 'your-app-uuid',
      event_type: 'open',
      device_id: 'device-123',
      country_code: 'US',
    },
    {
      app_id: 'your-app-uuid',
      event_type: 'click',
      device_id: 'device-456',
      country_code: 'CA',
      event_data: {
        button_id: 'subscribe',
        screen: 'home',
      },
    },
  ];

  const response = await fetch('http://localhost:8787/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ events }),
  });

  const result = await response.json();
  console.log('Batch result:', result);
  // { ok: true, accepted: 3, duplicates: 0, rejected: 0 }
}

// Large batch ingestion (optimized endpoint)
async function sendLargeBatch() {
  const events = [];
  
  // Generate 1000 events
  for (let i = 0; i < 1000; i++) {
    events.push({
      app_id: 'your-app-uuid',
      event_type: i % 2 === 0 ? 'open' : 'heartbeat',
      device_id: `device-${i % 100}`,
      country_code: ['US', 'CA', 'UK', 'DE', 'FR'][i % 5],
    });
  }

  const response = await fetch('http://localhost:8787/api/events/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ events }),
  });

  const result = await response.json();
  console.log('Large batch result:', result);
  // { ok: true, accepted: 1000, duplicates: 0, rejected: 0 }
}

// Push notification tracking
async function trackPushNotification() {
  const events = [
    // When notification is received
    {
      app_id: 'your-app-uuid',
      event_type: 'push_received',
      device_id: 'device-123',
      event_data: {
        notification_id: 'notif-456',
        campaign_id: 'camp-789',
      },
    },
    // When user opens the notification
    {
      app_id: 'your-app-uuid',
      event_type: 'push_opened',
      device_id: 'device-123',
      event_data: {
        notification_id: 'notif-456',
        campaign_id: 'camp-789',
      },
    },
    // When user clicks action in notification
    {
      app_id: 'your-app-uuid',
      event_type: 'push_clicked',
      device_id: 'device-123',
      event_data: {
        notification_id: 'notif-456',
        campaign_id: 'camp-789',
        action: 'view_offer',
      },
    },
  ];

  const response = await fetch('http://localhost:8787/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ events }),
  });

  const result = await response.json();
  console.log('Push tracking result:', result);
}

// Error handling example
async function handleErrors() {
  try {
    const response = await fetch('http://localhost:8787/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events: [
          {
            // Missing required fields
            event_type: 'install',
          },
          {
            app_id: 'your-app-uuid',
            event_type: 'invalid_event_type', // Invalid event type
            device_id: 'device-123',
          },
        ],
      }),
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Error:', result.error);
      if (result.errors) {
        console.error('Validation errors:', result.errors);
      }
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

// Rate limiting example
async function demonstrateRateLimit() {
  console.log('Sending 150 requests (rate limit is 100/min)...');
  
  const promises = [];
  for (let i = 0; i < 150; i++) {
    promises.push(
      fetch('http://localhost:8787/sdk/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: 'your-app-uuid',
          event_type: 'heartbeat',
          device_id: `device-${i}`,
        }),
      })
    );
  }

  const results = await Promise.all(promises);
  const rateLimited = results.filter(r => r.status === 429).length;
  
  console.log(`${rateLimited} requests were rate limited (429 status)`);
}

// Run examples
async function main() {
  console.log('=== ApkZio Event Ingestion Examples ===\n');
  
  console.log('1. Single event:');
  await sendSingleEvent();
  
  console.log('\n2. Batch events:');
  await sendBatchEvents();
  
  console.log('\n3. Large batch (1000 events):');
  await sendLargeBatch();
  
  console.log('\n4. Push notification tracking:');
  await trackPushNotification();
  
  console.log('\n5. Error handling:');
  await handleErrors();
  
  console.log('\n6. Rate limiting demonstration:');
  await demonstrateRateLimit();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  sendSingleEvent,
  sendBatchEvents,
  sendLargeBatch,
  trackPushNotification,
  handleErrors,
  demonstrateRateLimit,
};
