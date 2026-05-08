/**
 * ApkZio Analytics Event Types
 * 
 * Defines the shape of analytics events collected from client devices.
 */

export type EventType = 
  | 'install' 
  | 'heartbeat' 
  | 'open' 
  | 'click' 
  | 'push_received'
  | 'push_opened'
  | 'push_clicked'
  | 'crash';

export interface AnalyticsEvent {
  app_id: string;
  event_type: EventType;
  device_id: string;
  country_code?: string;
  event_data?: Record<string, any>;
  timestamp?: string;
}

export interface EventBatch {
  events: AnalyticsEvent[];
}

export const VALID_EVENT_TYPES: readonly EventType[] = [
  'install',
  'heartbeat',
  'open',
  'click',
  'push_received',
  'push_opened',
  'push_clicked',
  'crash',
] as const;
