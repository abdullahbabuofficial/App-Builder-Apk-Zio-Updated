-- Core ApkZio Schema
-- Apps, Campaigns, Devices, Subscribers, API Keys, APK Builds

-- Apps
CREATE TABLE android_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  package_name TEXT UNIQUE NOT NULL,
  app_key TEXT UNIQUE NOT NULL,
  icon_glyph TEXT,
  icon_color TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  fcm_project_id TEXT,
  live_users INT DEFAULT 0,
  active_devices_24h INT DEFAULT 0,
  total_installs INT DEFAULT 0,
  delivery_rate DECIMAL(5,4) DEFAULT 0.95,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE push_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  click_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  target_type TEXT NOT NULL,
  active_within_minutes INT,
  country_codes TEXT[],
  device_ids TEXT[],
  target_summary TEXT,
  recipients_count INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  install_hash TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  os_version TEXT,
  app_version TEXT,
  country_code TEXT,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, install_hash)
);

-- Subscribers
CREATE TABLE push_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  fcm_token_redacted TEXT,
  is_valid BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, fcm_token)
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_preview TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  rate_limit_rpm INT DEFAULT 600,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- APK Builds
CREATE TABLE apk_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  version_code INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  config JSONB,
  build_started_at TIMESTAMPTZ,
  build_completed_at TIMESTAMPTZ,
  build_logs TEXT,
  apk_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_apps_owner ON android_apps(owner_id);
CREATE INDEX idx_campaigns_app ON push_campaigns(app_id);
CREATE INDEX idx_campaigns_status ON push_campaigns(status);
CREATE INDEX idx_devices_app ON devices(app_id);
CREATE INDEX idx_subscribers_app ON push_subscribers(app_id);
CREATE INDEX idx_keys_app ON api_keys(app_id);
CREATE INDEX idx_builds_app ON apk_builds(app_id);
