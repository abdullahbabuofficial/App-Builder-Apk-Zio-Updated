/**
 * Event validation and deduplication logic
 */

import type { AnalyticsEvent } from './events.js';
import { VALID_EVENT_TYPES } from './events.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a single analytics event
 */
export function validateEvent(event: any): ValidationResult {
  if (!event) {
    return { valid: false, error: 'Event is null or undefined' };
  }

  if (!event.app_id) {
    return { valid: false, error: 'Missing app_id' };
  }

  if (typeof event.app_id !== 'string' || event.app_id.trim().length === 0) {
    return { valid: false, error: 'Invalid app_id format' };
  }

  if (!event.event_type) {
    return { valid: false, error: 'Missing event_type' };
  }

  if (!VALID_EVENT_TYPES.includes(event.event_type)) {
    return { 
      valid: false, 
      error: `Invalid event_type: ${event.event_type}. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` 
    };
  }

  if (!event.device_id) {
    return { valid: false, error: 'Missing device_id' };
  }

  if (typeof event.device_id !== 'string' || event.device_id.trim().length === 0) {
    return { valid: false, error: 'Invalid device_id format' };
  }

  // Validate optional fields
  if (event.country_code !== undefined && event.country_code !== null) {
    if (typeof event.country_code !== 'string' || event.country_code.length > 10) {
      return { valid: false, error: 'Invalid country_code format' };
    }
  }

  if (event.event_data !== undefined && event.event_data !== null) {
    if (typeof event.event_data !== 'object' || Array.isArray(event.event_data)) {
      return { valid: false, error: 'event_data must be an object' };
    }
  }

  if (event.timestamp !== undefined && event.timestamp !== null) {
    if (typeof event.timestamp !== 'string') {
      return { valid: false, error: 'timestamp must be a string (ISO 8601 format)' };
    }
    // Basic ISO 8601 validation
    const timestamp = new Date(event.timestamp);
    if (isNaN(timestamp.getTime())) {
      return { valid: false, error: 'Invalid timestamp format (must be ISO 8601)' };
    }
  }

  return { valid: true };
}

/**
 * Deduplicates events based on a composite key of app_id, event_type, device_id, and timestamp
 */
export function deduplicateEvents(events: AnalyticsEvent[]): AnalyticsEvent[] {
  const seen = new Set<string>();
  const unique: AnalyticsEvent[] = [];

  for (const event of events) {
    // Normalize timestamp to ensure consistent deduplication
    const timestamp = event.timestamp || new Date().toISOString();
    const key = `${event.app_id}:${event.event_type}:${event.device_id}:${timestamp}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  }

  return unique;
}

/**
 * Batch validates multiple events and returns validation results
 */
export function validateEventBatch(events: any[]): {
  valid: AnalyticsEvent[];
  errors: Array<{ index: number; error: string; event: any }>;
} {
  const valid: AnalyticsEvent[] = [];
  const errors: Array<{ index: number; error: string; event: any }> = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const validation = validateEvent(event);
    
    if (validation.valid) {
      valid.push(event as AnalyticsEvent);
    } else {
      errors.push({
        index: i,
        error: validation.error!,
        event,
      });
    }
  }

  return { valid, errors };
}
