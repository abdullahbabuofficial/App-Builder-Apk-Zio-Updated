-- Analytics Aggregation Tables
-- Phase 4: Hourly and daily rollups for fast analytics queries

-- Update hourly rollups to include country breakdown
ALTER TABLE analytics_hourly_rollups
ADD COLUMN IF NOT EXISTS country_breakdown JSONB;

-- Daily Rollups
CREATE TABLE IF NOT EXISTS analytics_daily_rollups (
  id BIGSERIAL PRIMARY KEY,
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  day_bucket DATE NOT NULL,
  installs INT DEFAULT 0,
  active_devices INT DEFAULT 0,
  heartbeats INT DEFAULT 0,
  push_sent INT DEFAULT 0,
  push_opened INT DEFAULT 0,
  crashes INT DEFAULT 0,
  country_breakdown JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_id, day_bucket)
);

CREATE INDEX IF NOT EXISTS idx_daily_rollups_app_day ON analytics_daily_rollups(app_id, day_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_daily_rollups_day ON analytics_daily_rollups(day_bucket DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_analytics_daily_rollups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_analytics_daily_rollups_updated_at ON analytics_daily_rollups;
CREATE TRIGGER trg_analytics_daily_rollups_updated_at
  BEFORE UPDATE ON analytics_daily_rollups
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_daily_rollups_updated_at();

-- Comments for documentation
COMMENT ON TABLE analytics_hourly_rollups IS 'Hourly aggregated analytics for fast queries';
COMMENT ON COLUMN analytics_hourly_rollups.country_breakdown IS 'JSON object with country codes as keys and counts as values';

COMMENT ON TABLE analytics_daily_rollups IS 'Daily aggregated analytics rolled up from hourly data';
COMMENT ON COLUMN analytics_daily_rollups.installs IS 'Total installs for the day';
COMMENT ON COLUMN analytics_daily_rollups.active_devices IS 'Unique active devices (max from hourly heartbeats)';
COMMENT ON COLUMN analytics_daily_rollups.heartbeats IS 'Total heartbeat events';
COMMENT ON COLUMN analytics_daily_rollups.push_sent IS 'Total push notifications sent';
COMMENT ON COLUMN analytics_daily_rollups.push_opened IS 'Total push notifications opened';
COMMENT ON COLUMN analytics_daily_rollups.crashes IS 'Total crash events';
COMMENT ON COLUMN analytics_daily_rollups.country_breakdown IS 'JSON object with event types and their country breakdowns';
