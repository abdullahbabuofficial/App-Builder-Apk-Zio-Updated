export type WebhookEventType =
  | 'campaign.sent'
  | 'campaign.delivered'
  | 'campaign.opened'
  | 'campaign.clicked'
  | 'campaign.failed'
  | 'app.created'
  | 'build.completed'
  | 'build.failed';

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  created_at: string;
  data: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_type: WebhookEventType;
  payload: WebhookPayload;
  response_code: number | null;
  response_body: string | null;
  attempt_count: number;
  delivered_at: string | null;
  created_at: string;
}
