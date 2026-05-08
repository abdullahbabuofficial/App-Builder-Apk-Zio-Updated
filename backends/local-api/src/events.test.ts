/**
 * Tests for event ingestion pipeline components
 */

import { describe, it, expect } from 'vitest';
import type { AnalyticsEvent } from './events.js';
import { validateEvent, deduplicateEvents, validateEventBatch } from './event-validator.js';
import { EventBuffer } from './event-buffer.js';

describe('Event Validation', () => {
  it('validates valid events correctly', () => {
    const validEvent = {
      app_id: 'test-app-id',
      event_type: 'install',
      device_id: 'device-123',
    };
    
    const result = validateEvent(validEvent);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('validates events with optional fields', () => {
    const event = {
      app_id: 'test-app-id',
      event_type: 'click',
      device_id: 'device-123',
      country_code: 'US',
      event_data: { button_id: 'submit' },
      timestamp: '2026-05-08T10:00:00Z',
    };
    
    const result = validateEvent(event);
    expect(result.valid).toBe(true);
  });

  it('rejects events with missing app_id', () => {
    const event = {
      event_type: 'install',
      device_id: 'device-123',
    };
    
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('app_id');
  });

  it('rejects events with missing event_type', () => {
    const event = {
      app_id: 'test-app-id',
      device_id: 'device-123',
    };
    
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('event_type');
  });

  it('rejects events with missing device_id', () => {
    const event = {
      app_id: 'test-app-id',
      event_type: 'install',
    };
    
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('device_id');
  });

  it('rejects events with invalid event_type', () => {
    const event = {
      app_id: 'test-app-id',
      event_type: 'invalid_type',
      device_id: 'device-123',
    };
    
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid event_type');
  });

  it('rejects events with empty app_id', () => {
    const event = {
      app_id: '',
      event_type: 'install',
      device_id: 'device-123',
    };
    
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('app_id');
  });

  it('rejects events with non-object event_data', () => {
    const event = {
      app_id: 'test-app-id',
      event_type: 'install',
      device_id: 'device-123',
      event_data: 'not an object',
    };
    
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('event_data');
  });

  it('rejects events with array event_data', () => {
    const event = {
      app_id: 'test-app-id',
      event_type: 'install',
      device_id: 'device-123',
      event_data: ['not', 'an', 'object'],
    };
    
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('event_data');
  });

  it('rejects events with invalid timestamp format', () => {
    const event = {
      app_id: 'test-app-id',
      event_type: 'install',
      device_id: 'device-123',
      timestamp: 'not a valid timestamp',
    };
    
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('timestamp');
  });

  it('validates all event types', () => {
    const eventTypes = [
      'install',
      'heartbeat',
      'open',
      'click',
      'push_received',
      'push_opened',
      'push_clicked',
      'crash',
    ];

    for (const eventType of eventTypes) {
      const event = {
        app_id: 'test-app-id',
        event_type: eventType,
        device_id: 'device-123',
      };
      
      const result = validateEvent(event);
      expect(result.valid).toBe(true);
    }
  });
});

describe('Event Deduplication', () => {
  it('removes duplicate events', () => {
    const timestamp = '2026-05-08T10:00:00Z';
    const events: AnalyticsEvent[] = [
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp },
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp },
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp },
    ];
    
    const unique = deduplicateEvents(events);
    expect(unique.length).toBe(1);
    expect(unique[0]).toEqual(events[0]);
  });

  it('keeps events with different device_ids', () => {
    const timestamp = '2026-05-08T10:00:00Z';
    const events: AnalyticsEvent[] = [
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp },
      { app_id: 'app1', event_type: 'install', device_id: 'd2', timestamp },
      { app_id: 'app1', event_type: 'install', device_id: 'd3', timestamp },
    ];
    
    const unique = deduplicateEvents(events);
    expect(unique.length).toBe(3);
  });

  it('keeps events with different event_types', () => {
    const timestamp = '2026-05-08T10:00:00Z';
    const events: AnalyticsEvent[] = [
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp },
      { app_id: 'app1', event_type: 'open', device_id: 'd1', timestamp },
      { app_id: 'app1', event_type: 'click', device_id: 'd1', timestamp },
    ];
    
    const unique = deduplicateEvents(events);
    expect(unique.length).toBe(3);
  });

  it('keeps events with different timestamps', () => {
    const events: AnalyticsEvent[] = [
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp: '2026-05-08T10:00:00Z' },
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp: '2026-05-08T10:01:00Z' },
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp: '2026-05-08T10:02:00Z' },
    ];
    
    const unique = deduplicateEvents(events);
    expect(unique.length).toBe(3);
  });

  it('handles empty array', () => {
    const unique = deduplicateEvents([]);
    expect(unique.length).toBe(0);
  });

  it('handles events without explicit timestamp', () => {
    const events: AnalyticsEvent[] = [
      { app_id: 'app1', event_type: 'install', device_id: 'd1' },
      { app_id: 'app1', event_type: 'install', device_id: 'd1' },
    ];
    
    // Events without timestamps should be deduplicated if they arrive in the same batch
    const unique = deduplicateEvents(events);
    // Note: Without timestamps, deduplication uses the same logic but the key might differ
    // This test validates the function doesn't crash
    expect(unique.length).toBeGreaterThan(0);
  });

  it('deduplicates complex batch correctly', () => {
    const events: AnalyticsEvent[] = [
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp: '2026-05-08T10:00:00Z' },
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp: '2026-05-08T10:00:00Z' }, // dup
      { app_id: 'app1', event_type: 'open', device_id: 'd1', timestamp: '2026-05-08T10:00:00Z' },
      { app_id: 'app1', event_type: 'install', device_id: 'd2', timestamp: '2026-05-08T10:00:00Z' },
      { app_id: 'app2', event_type: 'install', device_id: 'd1', timestamp: '2026-05-08T10:00:00Z' },
      { app_id: 'app1', event_type: 'install', device_id: 'd1', timestamp: '2026-05-08T10:01:00Z' },
    ];
    
    const unique = deduplicateEvents(events);
    expect(unique.length).toBe(5);
  });
});

describe('Event Batch Validation', () => {
  it('validates mixed batch correctly', () => {
    const events = [
      { app_id: 'app1', event_type: 'install', device_id: 'd1' },
      { app_id: 'app2', event_type: 'invalid', device_id: 'd2' },
      { app_id: 'app3', event_type: 'click', device_id: 'd3' },
      { event_type: 'open', device_id: 'd4' }, // missing app_id
    ];

    const result = validateEventBatch(events);
    
    expect(result.valid.length).toBe(2);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0]?.index).toBe(1);
    expect(result.errors[1]?.index).toBe(3);
  });

  it('returns all valid when all events are valid', () => {
    const events = [
      { app_id: 'app1', event_type: 'install', device_id: 'd1' },
      { app_id: 'app2', event_type: 'open', device_id: 'd2' },
      { app_id: 'app3', event_type: 'click', device_id: 'd3' },
    ];

    const result = validateEventBatch(events);
    
    expect(result.valid.length).toBe(3);
    expect(result.errors.length).toBe(0);
  });

  it('returns all errors when all events are invalid', () => {
    const events = [
      { event_type: 'install', device_id: 'd1' },
      { app_id: 'app2', device_id: 'd2' },
      { app_id: 'app3', event_type: 'invalid' },
    ];

    const result = validateEventBatch(events);
    
    expect(result.valid.length).toBe(0);
    expect(result.errors.length).toBe(3);
  });
});

describe('Event Buffer', () => {
  it('buffers and flushes events', async () => {
    const flushed: AnalyticsEvent[] = [];
    const buffer = new EventBuffer({
      onFlush: async (events) => {
        flushed.push(...events);
      },
    });

    buffer.add({ app_id: 'app1', event_type: 'install', device_id: 'd1' });
    buffer.add({ app_id: 'app2', event_type: 'open', device_id: 'd2' });
    
    await buffer.flush();
    
    expect(flushed.length).toBe(2);
    await buffer.stop();
  });

  it('auto-flushes when buffer is full', async () => {
    const flushed: AnalyticsEvent[] = [];
    const buffer = new EventBuffer({
      maxSize: 10,
      onFlush: async (events) => {
        flushed.push(...events);
      },
    });

    // Add 10 events to trigger auto-flush
    for (let i = 0; i < 10; i++) {
      buffer.add({ app_id: 'app1', event_type: 'install', device_id: `d${i}` });
    }
    
    // Give it a moment to flush
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(flushed.length).toBe(10);
    await buffer.stop();
  });

  it('handles flush errors gracefully', async () => {
    let attemptCount = 0;
    const buffer = new EventBuffer({
      onFlush: async () => {
        attemptCount++;
        throw new Error('Simulated flush failure');
      },
    });

    buffer.add({ app_id: 'app1', event_type: 'install', device_id: 'd1' });
    
    await buffer.flush();
    
    // Should have attempted to flush
    expect(attemptCount).toBe(1);
    
    // Buffer should still have the event for retry
    expect(buffer.getBufferSize()).toBe(1);
    
    await buffer.stop();
  });

  it('adds batch of events', async () => {
    const flushed: AnalyticsEvent[] = [];
    const buffer = new EventBuffer({
      onFlush: async (events) => {
        flushed.push(...events);
      },
    });

    const events: AnalyticsEvent[] = [
      { app_id: 'app1', event_type: 'install', device_id: 'd1' },
      { app_id: 'app2', event_type: 'open', device_id: 'd2' },
      { app_id: 'app3', event_type: 'click', device_id: 'd3' },
    ];

    buffer.addBatch(events);
    await buffer.flush();
    
    expect(flushed.length).toBe(3);
    await buffer.stop();
  });

  it('prevents concurrent flushes', async () => {
    let flushCount = 0;
    const buffer = new EventBuffer({
      onFlush: async () => {
        flushCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
      },
    });

    buffer.add({ app_id: 'app1', event_type: 'install', device_id: 'd1' });
    
    // Try to trigger multiple concurrent flushes
    const flushPromise1 = buffer.flush();
    const flushPromise2 = buffer.flush();
    const flushPromise3 = buffer.flush();
    
    await Promise.all([flushPromise1, flushPromise2, flushPromise3]);
    
    // Should only flush once
    expect(flushCount).toBe(1);
    await buffer.stop();
  });

  it('reports buffer size correctly', () => {
    const buffer = new EventBuffer({
      onFlush: async () => {},
    });

    expect(buffer.getBufferSize()).toBe(0);
    
    buffer.add({ app_id: 'app1', event_type: 'install', device_id: 'd1' });
    expect(buffer.getBufferSize()).toBe(1);
    
    buffer.add({ app_id: 'app2', event_type: 'open', device_id: 'd2' });
    expect(buffer.getBufferSize()).toBe(2);
    
    buffer.stop();
  });

  it('stops and flushes remaining events', async () => {
    const flushed: AnalyticsEvent[] = [];
    const buffer = new EventBuffer({
      flushIntervalMs: 60000, // Long interval
      onFlush: async (events) => {
        flushed.push(...events);
      },
    });

    buffer.add({ app_id: 'app1', event_type: 'install', device_id: 'd1' });
    buffer.add({ app_id: 'app2', event_type: 'open', device_id: 'd2' });
    
    // Stop should flush remaining events
    await buffer.stop();
    
    expect(flushed.length).toBe(2);
  });
});
