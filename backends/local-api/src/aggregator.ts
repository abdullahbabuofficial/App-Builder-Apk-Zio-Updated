/**
 * Analytics Aggregator
 * 
 * Background worker that aggregates raw analytics events into:
 * - Hourly rollups (for recent data)
 * - Daily rollups (for historical trends)
 * 
 * This dramatically improves query performance by pre-computing aggregations
 * instead of scanning millions of raw event rows.
 */

import { query } from './db.js';

export class AnalyticsAggregator {
  private intervalId: NodeJS.Timeout | null = null;
  private dailyIntervalId: NodeJS.Timeout | null = null;
  
  /**
   * Start the aggregator with scheduled runs
   */
  start() {
    console.log('📊 Analytics Aggregator starting...');
    
    // Run hourly aggregation every hour
    this.intervalId = setInterval(() => {
      void this.runHourlyAggregation();
    }, 3600_000); // 60 minutes
    
    // Run daily aggregation at midnight (plus 5 min buffer)
    this.scheduleDailyAggregation();
    
    // Run immediately on start for last hour
    void this.runHourlyAggregation();
    
    console.log('✅ Analytics Aggregator started');
  }
  
  /**
   * Stop the aggregator
   */
  stop() {
    console.log('📊 Analytics Aggregator stopping...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.dailyIntervalId) {
      clearInterval(this.dailyIntervalId);
      this.dailyIntervalId = null;
    }
    
    console.log('✅ Analytics Aggregator stopped');
  }
  
  /**
   * Schedule daily aggregation to run at midnight
   */
  private scheduleDailyAggregation() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 5, 0, 0); // 00:05:00
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      void this.runDailyAggregation();
      
      // After first run, schedule every 24 hours
      this.dailyIntervalId = setInterval(() => {
        void this.runDailyAggregation();
      }, 86400_000); // 24 hours
    }, msUntilMidnight);
    
    console.log(`📅 Daily aggregation scheduled for ${tomorrow.toISOString()}`);
  }
  
  /**
   * Aggregate events from the last completed hour
   */
  async runHourlyAggregation() {
    console.log('⏰ Starting hourly aggregation...');
    const startTime = Date.now();
    
    try {
      // Get the last completed hour
      const hourStart = new Date();
      hourStart.setMinutes(0, 0, 0);
      hourStart.setHours(hourStart.getHours() - 1);
      
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);
      
      console.log(`  📍 Aggregating from ${hourStart.toISOString()} to ${hourEnd.toISOString()}`);
      
      // Aggregate by app and event type with country breakdown
      const result = await query(`
        INSERT INTO analytics_hourly_rollups 
          (app_id, event_type, hour_bucket, event_count, unique_devices, country_breakdown)
        SELECT 
          app_id,
          event_type,
          $1::timestamptz as hour_bucket,
          COUNT(*) as event_count,
          COUNT(DISTINCT device_id) as unique_devices,
          CASE 
            WHEN COUNT(*) FILTER (WHERE country_code IS NOT NULL) > 0 THEN
              jsonb_object_agg(
                COALESCE(country_code, 'unknown'), 
                country_count
              ) FILTER (WHERE country_code IS NOT NULL OR country_count > 0)
            ELSE NULL
          END as country_breakdown
        FROM (
          SELECT 
            app_id,
            event_type,
            device_id,
            COALESCE(country_code, 'unknown') as country_code,
            COUNT(*) as country_count
          FROM analytics_events
          WHERE timestamp >= $1 AND timestamp < $2
          GROUP BY app_id, event_type, device_id, COALESCE(country_code, 'unknown')
        ) grouped
        GROUP BY app_id, event_type
        ON CONFLICT (app_id, event_type, hour_bucket) 
        DO UPDATE SET
          event_count = EXCLUDED.event_count,
          unique_devices = EXCLUDED.unique_devices,
          country_breakdown = EXCLUDED.country_breakdown
      `, [hourStart, hourEnd]);
      
      const duration = Date.now() - startTime;
      const rowCount = result.rowCount || 0;
      console.log(`✅ Hourly aggregation complete: ${rowCount} rollups created/updated (${duration}ms)`);
    } catch (err) {
      console.error('❌ Hourly aggregation failed:', err);
      throw err;
    }
  }
  
  /**
   * Aggregate hourly data into daily rollups for yesterday
   */
  async runDailyAggregation() {
    console.log('📅 Starting daily aggregation...');
    const startTime = Date.now();
    
    try {
      // Get yesterday (full day)
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - 1);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      console.log(`  📍 Aggregating from ${dayStart.toISOString()} to ${dayEnd.toISOString()}`);
      
      // Aggregate from hourly rollups into daily
      const result = await query(`
        INSERT INTO analytics_daily_rollups 
          (app_id, day_bucket, installs, active_devices, heartbeats, push_sent, push_opened, crashes, country_breakdown)
        SELECT 
          app_id,
          $1::date as day_bucket,
          COALESCE(SUM(CASE WHEN event_type = 'install' THEN event_count END), 0) as installs,
          COALESCE(MAX(CASE WHEN event_type = 'heartbeat' THEN unique_devices END), 0) as active_devices,
          COALESCE(SUM(CASE WHEN event_type = 'heartbeat' THEN event_count END), 0) as heartbeats,
          COALESCE(SUM(CASE WHEN event_type = 'push_received' THEN event_count END), 0) as push_sent,
          COALESCE(SUM(CASE WHEN event_type = 'push_opened' THEN event_count END), 0) as push_opened,
          COALESCE(SUM(CASE WHEN event_type = 'crash' THEN event_count END), 0) as crashes,
          jsonb_object_agg(event_type, country_breakdown) FILTER (WHERE country_breakdown IS NOT NULL) as country_breakdown
        FROM analytics_hourly_rollups
        WHERE hour_bucket >= $1 AND hour_bucket < $2
        GROUP BY app_id
        ON CONFLICT (app_id, day_bucket)
        DO UPDATE SET
          installs = EXCLUDED.installs,
          active_devices = EXCLUDED.active_devices,
          heartbeats = EXCLUDED.heartbeats,
          push_sent = EXCLUDED.push_sent,
          push_opened = EXCLUDED.push_opened,
          crashes = EXCLUDED.crashes,
          country_breakdown = EXCLUDED.country_breakdown,
          updated_at = NOW()
      `, [dayStart, dayEnd]);
      
      const duration = Date.now() - startTime;
      const rowCount = result.rowCount || 0;
      console.log(`✅ Daily aggregation complete: ${rowCount} daily rollups created/updated (${duration}ms)`);
    } catch (err) {
      console.error('❌ Daily aggregation failed:', err);
      throw err;
    }
  }
  
  /**
   * Manual trigger for backfilling historical data
   * Aggregates all hours between start and end dates
   */
  async backfillHourlyAggregations(startDate: Date, endDate: Date) {
    console.log(`🔄 Backfilling hourly aggregations from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const hours: Date[] = [];
    const current = new Date(startDate);
    current.setMinutes(0, 0, 0);
    
    while (current < endDate) {
      hours.push(new Date(current));
      current.setHours(current.getHours() + 1);
    }
    
    console.log(`  📊 Processing ${hours.length} hours...`);
    
    for (const hourStart of hours) {
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);
      
      try {
        await query(`
          INSERT INTO analytics_hourly_rollups 
            (app_id, event_type, hour_bucket, event_count, unique_devices, country_breakdown)
          SELECT 
            app_id,
            event_type,
            $1::timestamptz as hour_bucket,
            COUNT(*) as event_count,
            COUNT(DISTINCT device_id) as unique_devices,
            CASE 
              WHEN COUNT(*) FILTER (WHERE country_code IS NOT NULL) > 0 THEN
                jsonb_object_agg(
                  COALESCE(country_code, 'unknown'), 
                  country_count
                ) FILTER (WHERE country_code IS NOT NULL OR country_count > 0)
              ELSE NULL
            END as country_breakdown
          FROM (
            SELECT 
              app_id,
              event_type,
              device_id,
              COALESCE(country_code, 'unknown') as country_code,
              COUNT(*) as country_count
            FROM analytics_events
            WHERE timestamp >= $1 AND timestamp < $2
            GROUP BY app_id, event_type, device_id, COALESCE(country_code, 'unknown')
          ) grouped
          GROUP BY app_id, event_type
          ON CONFLICT (app_id, event_type, hour_bucket) 
          DO UPDATE SET
            event_count = EXCLUDED.event_count,
            unique_devices = EXCLUDED.unique_devices,
            country_breakdown = EXCLUDED.country_breakdown
        `, [hourStart, hourEnd]);
      } catch (err) {
        console.error(`  ❌ Failed to aggregate hour ${hourStart.toISOString()}:`, err);
      }
    }
    
    console.log(`✅ Backfill complete: ${hours.length} hours processed`);
  }
  
  /**
   * Manual trigger for backfilling daily aggregations
   */
  async backfillDailyAggregations(startDate: Date, endDate: Date) {
    console.log(`🔄 Backfilling daily aggregations from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const days: Date[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    
    while (current < endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    console.log(`  📊 Processing ${days.length} days...`);
    
    for (const dayStart of days) {
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      try {
        await query(`
          INSERT INTO analytics_daily_rollups 
            (app_id, day_bucket, installs, active_devices, heartbeats, push_sent, push_opened, crashes, country_breakdown)
          SELECT 
            app_id,
            $1::date as day_bucket,
            COALESCE(SUM(CASE WHEN event_type = 'install' THEN event_count END), 0) as installs,
            COALESCE(MAX(CASE WHEN event_type = 'heartbeat' THEN unique_devices END), 0) as active_devices,
            COALESCE(SUM(CASE WHEN event_type = 'heartbeat' THEN event_count END), 0) as heartbeats,
            COALESCE(SUM(CASE WHEN event_type = 'push_received' THEN event_count END), 0) as push_sent,
            COALESCE(SUM(CASE WHEN event_type = 'push_opened' THEN event_count END), 0) as push_opened,
            COALESCE(SUM(CASE WHEN event_type = 'crash' THEN event_count END), 0) as crashes,
            jsonb_object_agg(event_type, country_breakdown) FILTER (WHERE country_breakdown IS NOT NULL) as country_breakdown
          FROM analytics_hourly_rollups
          WHERE hour_bucket >= $1 AND hour_bucket < $2
          GROUP BY app_id
          ON CONFLICT (app_id, day_bucket)
          DO UPDATE SET
            installs = EXCLUDED.installs,
            active_devices = EXCLUDED.active_devices,
            heartbeats = EXCLUDED.heartbeats,
            push_sent = EXCLUDED.push_sent,
            push_opened = EXCLUDED.push_opened,
            crashes = EXCLUDED.crashes,
            country_breakdown = EXCLUDED.country_breakdown,
            updated_at = NOW()
        `, [dayStart, dayEnd]);
      } catch (err) {
        console.error(`  ❌ Failed to aggregate day ${dayStart.toISOString()}:`, err);
      }
    }
    
    console.log(`✅ Backfill complete: ${days.length} days processed`);
  }
}

// Singleton instance
export const aggregator = new AnalyticsAggregator();
