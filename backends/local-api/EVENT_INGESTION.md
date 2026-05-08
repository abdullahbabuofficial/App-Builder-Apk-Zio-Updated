# Event Ingestion Pipeline

Implementation of real-time analytics event ingestion for ApkZio.

## Overview

This implementation replaces the fake analytics data (from `mulberry32` PRNG) with a real event tracking system that can handle high-volume event ingestion.

## Components

### 1. Event Types (`events.ts`)
Defines the schema for analytics events:
- `install` - App installation
- `heartbeat` - Periodic app activity
- `open` - App opened
- `click` - User interaction
- `push_received` - Push notification received
- `push_opened` - Push notification opened
- `push_clicked` - Push notification clicked
- `crash` - App crash

### 2. Event Validator (`event-validator.ts`)
- **validateEvent**: Validates individual events
- **deduplicateEvents**: Removes duplicate events based on composite key
- **validateEventBatch**: Batch validation with error reporting

### 3. Event Buffer (`event-buffer.ts`)
- Buffers incoming events to prevent database overload
- Auto-flushes based on:
  - Buffer size (default: 1000 events)
  - Time interval (default: 5 seconds)
- Handles flush errors with retry logic
- Prevents concurrent flushes

### 4. Store Methods (`store.ts`)
- **insertEvents**: Batch insert analytics events
- **getEventCounts**: Get event counts grouped by time
- **getEventCount**: Get total count for event type
- **getUniqueDeviceCount**: Get unique device count for event type

### 5. API Endpoints (`server.ts`)

#### Single Event Ingestion
```
POST /sdk/event
```

**Request:**
```json
{
  "app_id": "uuid",
  "event_type": "install",
  "device_id": "device-123",
  "country_code": "US",
  "event_data": { "key": "value" },
  "timestamp": "2026-05-08T10:00:00Z"
}
```

**Response:**
```json
{
  "ok": true,
  "accepted": 1,
  "rejected": 0
}
```

#### Batch Event Ingestion
```
POST /api/events
```

**Request:**
```json
{
  "events": [
    {
      "app_id": "uuid",
      "event_type": "install",
      "device_id": "device-123"
    },
    {
      "app_id": "uuid",
      "event_type": "open",
      "device_id": "device-456"
    }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "accepted": 2,
  "duplicates": 0,
  "rejected": 0
}
```

#### Bulk Batch Ingestion
```
POST /api/events/batch
```

Optimized for very large batches (1000+ events). Same format as `/api/events`.

## Rate Limiting

All event endpoints are rate-limited to:
- **100 requests per minute per IP address**

Exceeding this limit returns:
```json
{
  "ok": false,
  "error": {
    "code": "rate_limited",
    "message": "Too many event requests. Try again later."
  }
}
```

## Error Handling

### Validation Errors
```json
{
  "ok": false,
  "error": {
    "code": "validation_failed",
    "message": "Missing app_id"
  }
}
```

### Batch Validation Errors
```json
{
  "ok": true,
  "accepted": 2,
  "duplicates": 0,
  "rejected": 1,
  "errors": [
    "Event 1: Invalid event_type: invalid_type"
  ]
}
```

## Database Schema

The `analytics_events` table stores all events:

```sql
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  device_id TEXT,
  country_code TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

Indexes:
- `idx_analytics_app_time` - Fast queries by app and time
- `idx_analytics_type` - Fast queries by event type
- `idx_analytics_device` - Fast queries by device

## Buffering & Performance

### Buffer Configuration
- **Max buffer size**: 1000 events
- **Flush interval**: 5 seconds
- **Graceful shutdown**: Flushes remaining events on SIGTERM/SIGINT

### Performance Characteristics
- Events are validated synchronously
- Events are buffered in-memory
- Batch inserts happen asynchronously
- Failed flushes are retried (up to buffer size limit)

## Testing

Run the test suite:
```bash
npm test -- events.test.ts
```

**Test Coverage:**
- 28 tests covering:
  - Event validation (all event types)
  - Field validation (required/optional)
  - Deduplication logic
  - Buffer management
  - Batch validation
  - Error handling

## Usage Example

See `examples/event-ingestion-example.ts` for a complete working example.

## Graceful Shutdown

The server automatically flushes all buffered events on shutdown:
```javascript
process.on('SIGTERM', async () => {
  await eventBuffer.stop(); // Flushes remaining events
  server.close();
});
```

## Monitoring

Check buffer health:
```javascript
console.log(`Buffer size: ${eventBuffer.getBufferSize()}`);
```

Logs:
- `[EventBuffer] Flushed N events` - Successful flush
- `[EventBuffer] Failed to flush events` - Flush error (with retry)
- `[Event Ingestion] Error processing event` - Validation/processing error

## Migration from Fake Data

The analytics now uses real events instead of `mulberry32` PRNG. To migrate:

1. Start sending real events via `/sdk/event` or `/api/events`
2. Analytics queries will automatically use the real event data
3. Remove or deprecate fake data generation code

## Security

- Rate limiting prevents abuse (100 req/min per IP)
- Input validation prevents injection attacks
- Event data is stored as JSONB (safe from SQL injection)
- Device IDs are hashed/anonymized at the SDK level

## Future Enhancements

Possible improvements:
- Redis-backed buffer for distributed deployments
- Event sampling for high-volume apps
- Real-time event streaming to analytics dashboards
- Automatic hourly rollup generation
- Event replay/backfill support
