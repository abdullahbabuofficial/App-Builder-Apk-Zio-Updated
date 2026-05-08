-- Analytics & Events Schema
-- Real-time events and hourly rollups for performance

-- Analytics Events
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  device_id TEXT,
  country_code TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_app_time ON analytics_events(app_id, timestamp DESC);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_device ON analytics_events(device_id);

-- Hourly Rollups (for performance)
CREATE TABLE analytics_hourly_rollups (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL,
  event_count INT DEFAULT 0,
  unique_devices INT DEFAULT 0,
  UNIQUE(app_id, event_type, hour_bucket)
);

CREATE INDEX idx_rollups_app_time ON analytics_hourly_rollups(app_id, hour_bucket DESC);
