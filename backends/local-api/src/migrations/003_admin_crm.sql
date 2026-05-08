-- Admin & CRM Schema
-- Client management, campaign errors, crash tracking

-- Admin Clients (from Phase 2A)
CREATE TABLE admin_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  plan TEXT NOT NULL DEFAULT 'starter',
  email_verified BOOLEAN DEFAULT false,
  google_linked BOOLEAN DEFAULT false,
  account_status TEXT NOT NULL DEFAULT 'lead',
  phone TEXT,
  location TEXT,
  website TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  lifetime_revenue BIGINT DEFAULT 0,
  apps_count INT DEFAULT 0,
  builds_count INT DEFAULT 0,
  active_subscriptions INT DEFAULT 0
);

-- Campaign Errors (from Phase 2B)
CREATE TABLE campaign_errors (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID REFERENCES push_campaigns(id) ON DELETE CASCADE,
  error_code TEXT NOT NULL,
  error_message TEXT,
  subscriber_id UUID,
  device_info JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Crash Events (from Phase 2B)
CREATE TABLE crash_events (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  device_id TEXT,
  crash_type TEXT NOT NULL,
  stack_trace TEXT,
  app_version TEXT,
  os_version TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_clients_email ON admin_clients(email);
CREATE INDEX idx_campaign_errors_campaign ON campaign_errors(campaign_id);
CREATE INDEX idx_crashes_app_time ON crash_events(app_id, timestamp DESC);
