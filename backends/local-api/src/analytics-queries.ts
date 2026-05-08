/**
 * Optimized Analytics Queries
 * 
 * High-performance queries using aggregated tables and caching
 */

import { query } from './db.js';
import { analyticsCache } from './analytics-cache.js';

/**
 * Get daily install counts for an app
 * Returns array of install counts ordered by date (oldest to newest)
 */
export async function getDailyInstalls(appId: string, days: number): Promise<number[]> {
  const cacheKey = `daily-installs:${appId}:${days}`;
  const cached = analyticsCache.get<number[]>(cacheKey);
  if (cached) return cached;
  
  try {
    const { rows } = await query<{ installs: number }>(`
      SELECT installs
      FROM analytics_daily_rollups
      WHERE app_id = $1
        AND day_bucket >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY day_bucket ASC
    `, [appId]);
    
    const data = rows.map(r => r.installs);
    analyticsCache.set(cacheKey, data, 300); // 5 min cache
    return data;
  } catch (err) {
    console.error('getDailyInstalls query failed:', err);
    return [];
  }
}

/**
 * Get hourly active device counts (from heartbeats)
 * Returns array of unique device counts ordered by hour
 */
export async function getHourlyHeartbeats(appId: string, hours: number): Promise<number[]> {
  const cacheKey = `hourly-heartbeats:${appId}:${hours}`;
  const cached = analyticsCache.get<number[]>(cacheKey);
  if (cached) return cached;
  
  try {
    const { rows } = await query<{ unique_devices: number }>(`
      SELECT unique_devices
      FROM analytics_hourly_rollups
      WHERE app_id = $1
        AND event_type = 'heartbeat'
        AND hour_bucket >= NOW() - INTERVAL '${hours} hours'
      ORDER BY hour_bucket ASC
    `, [appId]);
    
    const data = rows.map(r => r.unique_devices);
    analyticsCache.set(cacheKey, data, 60); // 1 min cache
    return data;
  } catch (err) {
    console.error('getHourlyHeartbeats query failed:', err);
    return [];
  }
}

/**
 * Get summary statistics for an app
 */
export async function getAppSummary(appId: string, days: number = 30) {
  const cacheKey = `app-summary:${appId}:${days}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const { rows } = await query<{
      total_installs: string;
      total_active_devices: string;
      total_crashes: string;
      avg_daily_active: string;
    }>(`
      SELECT 
        SUM(installs)::bigint as total_installs,
        MAX(active_devices)::bigint as total_active_devices,
        SUM(crashes)::bigint as total_crashes,
        AVG(active_devices)::bigint as avg_daily_active
      FROM analytics_daily_rollups
      WHERE app_id = $1
        AND day_bucket >= CURRENT_DATE - INTERVAL '${days} days'
    `, [appId]);
    
    const data = {
      totalInstalls: parseInt(rows[0]?.total_installs || '0', 10),
      totalActiveDevices: parseInt(rows[0]?.total_active_devices || '0', 10),
      totalCrashes: parseInt(rows[0]?.total_crashes || '0', 10),
      avgDailyActive: parseInt(rows[0]?.avg_daily_active || '0', 10),
    };
    
    analyticsCache.set(cacheKey, data, 300); // 5 min cache
    return data;
  } catch (err) {
    console.error('getAppSummary query failed:', err);
    return {
      totalInstalls: 0,
      totalActiveDevices: 0,
      totalCrashes: 0,
      avgDailyActive: 0,
    };
  }
}

/**
 * Get push notification statistics
 */
export async function getPushStats(appId: string, days: number = 30) {
  const cacheKey = `push-stats:${appId}:${days}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const { rows } = await query<{
      total_sent: string;
      total_opened: string;
    }>(`
      SELECT 
        SUM(push_sent)::bigint as total_sent,
        SUM(push_opened)::bigint as total_opened
      FROM analytics_daily_rollups
      WHERE app_id = $1
        AND day_bucket >= CURRENT_DATE - INTERVAL '${days} days'
    `, [appId]);
    
    const sent = parseInt(rows[0]?.total_sent || '0', 10);
    const opened = parseInt(rows[0]?.total_opened || '0', 10);
    
    const data = {
      totalSent: sent,
      totalOpened: opened,
      openRate: sent > 0 ? (opened / sent * 100).toFixed(2) : '0.00',
    };
    
    analyticsCache.set(cacheKey, data, 300); // 5 min cache
    return data;
  } catch (err) {
    console.error('getPushStats query failed:', err);
    return {
      totalSent: 0,
      totalOpened: 0,
      openRate: '0.00',
    };
  }
}

/**
 * Get recent events (for real-time dashboard)
 * This queries raw events table (not aggregated) for latest activity
 */
export async function getRecentEvents(appId: string, limit: number = 20) {
  const cacheKey = `recent-events:${appId}:${limit}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const { rows } = await query<{
      event_type: string;
      device_id: string;
      country_code: string;
      timestamp: Date;
    }>(`
      SELECT 
        event_type,
        device_id,
        country_code,
        timestamp
      FROM analytics_events
      WHERE app_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `, [appId, limit]);
    
    analyticsCache.set(cacheKey, rows, 10); // 10 sec cache (very short for real-time)
    return rows;
  } catch (err) {
    console.error('getRecentEvents query failed:', err);
    return [];
  }
}

/**
 * Get trend data for a specific event type
 */
export async function getEventTrend(
  appId: string | undefined,
  eventType: string,
  hours: number = 48
): Promise<Array<{ hour: string; count: number }>> {
  const cacheKey = `event-trend:${appId || 'all'}:${eventType}:${hours}`;
  const cached = analyticsCache.get<Array<{ hour: string; count: number }>>(cacheKey);
  if (cached) return cached;
  
  try {
    const whereClause = appId ? `WHERE app_id = $1 AND event_type = $2` : `WHERE event_type = $1`;
    const params = appId ? [appId, eventType] : [eventType];
    
    const { rows } = await query<{
      hour_bucket: Date;
      event_count: number;
    }>(`
      SELECT 
        hour_bucket,
        ${appId ? 'event_count' : 'SUM(event_count)::bigint as event_count'}
      FROM analytics_hourly_rollups
      ${whereClause}
        AND hour_bucket >= NOW() - INTERVAL '${hours} hours'
      ${appId ? '' : 'GROUP BY hour_bucket'}
      ORDER BY hour_bucket ASC
    `, params);
    
    const data = rows.map(r => ({
      hour: r.hour_bucket.toISOString(),
      count: r.event_count,
    }));
    
    analyticsCache.set(cacheKey, data, 120); // 2 min cache
    return data;
  } catch (err) {
    console.error('getEventTrend query failed:', err);
    return [];
  }
}

/**
 * Invalidate all cache for a specific app
 * Call this when aggregations run or data changes
 */
export function invalidateAppCache(appId: string) {
  analyticsCache.invalidatePattern(appId);
}

/**
 * Get global analytics overview for all apps or a specific app
 * Returns data in the format expected by the frontend
 */
export async function getGlobalAnalyticsOverview(
  appId?: string,
  days: number = 30
): Promise<{
  dailyInstalls: Array<{ t: number; v: number }>;
  hourlyHeartbeats: Array<{ t: number; v: number }>;
  geoBreakdown: Array<{ code: string; name: string; v: number; pct: number }>;
  recentEvents: Array<{ id: string; name: string; count: number; uniqueDevices: number; deltaPct: number }>;
}> {
  const cacheKey = `global-overview:${appId || 'all'}:${days}`;
  const cached = analyticsCache.get<any>(cacheKey);
  if (cached) return cached;

  try {
    // Get daily installs
    const whereClause = appId ? `WHERE app_id = $1` : ``;
    const params = appId ? [appId] : [];
    
    const { rows: installRows } = await query<{ day_bucket: Date; installs: number }>(`
      SELECT 
        day_bucket,
        ${appId ? 'installs' : 'SUM(installs)::bigint as installs'}
      FROM analytics_daily_rollups
      ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} day_bucket >= CURRENT_DATE - INTERVAL '${days} days'
      ${appId ? '' : 'GROUP BY day_bucket'}
      ORDER BY day_bucket ASC
    `, params);

    const dailyInstalls = installRows.map(r => ({
      t: r.day_bucket.getTime(),
      v: r.installs,
    }));

    // Get hourly heartbeats (last 48 hours)
    const { rows: heartbeatRows } = await query<{ hour_bucket: Date; unique_devices: number }>(`
      SELECT 
        hour_bucket,
        ${appId ? 'unique_devices' : 'SUM(unique_devices)::bigint as unique_devices'}
      FROM analytics_hourly_rollups
      ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} event_type = 'heartbeat'
        AND hour_bucket >= NOW() - INTERVAL '48 hours'
      ${appId ? '' : 'GROUP BY hour_bucket'}
      ORDER BY hour_bucket ASC
    `, params);

    const hourlyHeartbeats = heartbeatRows.map(r => ({
      t: r.hour_bucket.getTime(),
      v: r.unique_devices,
    }));

    // Get geo breakdown (top 20 countries)
    const { rows: geoRows } = await query<{ country_code: string; total_count: string }>(`
      SELECT 
        country_code,
        SUM(event_count)::bigint as total_count
      FROM analytics_hourly_rollups
      ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} event_type = 'heartbeat'
        AND hour_bucket >= NOW() - INTERVAL '${days} days'
        AND country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY total_count DESC
      LIMIT 20
    `, params);

    const totalGeo = geoRows.reduce((sum, r) => sum + parseInt(r.total_count, 10), 0);
    const geoBreakdown = geoRows.map(r => {
      const count = parseInt(r.total_count, 10);
      return {
        code: r.country_code,
        name: r.country_code, // TODO: Add country name lookup
        v: count,
        pct: totalGeo > 0 ? (count / totalGeo) * 100 : 0,
      };
    });

    // Get recent events (top 20 by count)
    const { rows: eventRows } = await query<{ 
      event_type: string; 
      total_count: string; 
      unique_devices: string;
      prev_count: string;
    }>(`
      WITH current_period AS (
        SELECT 
          event_type,
          SUM(event_count)::bigint as total_count,
          SUM(unique_devices)::bigint as unique_devices
        FROM analytics_hourly_rollups
        ${whereClause}
          ${whereClause ? 'AND' : 'WHERE'} hour_bucket >= NOW() - INTERVAL '${days} days'
        GROUP BY event_type
      ),
      previous_period AS (
        SELECT 
          event_type,
          SUM(event_count)::bigint as prev_count
        FROM analytics_hourly_rollups
        ${whereClause}
          ${whereClause ? 'AND' : 'WHERE'} hour_bucket >= NOW() - INTERVAL '${days * 2} days'
          AND hour_bucket < NOW() - INTERVAL '${days} days'
        GROUP BY event_type
      )
      SELECT 
        c.event_type,
        c.total_count,
        c.unique_devices,
        COALESCE(p.prev_count, 0) as prev_count
      FROM current_period c
      LEFT JOIN previous_period p ON c.event_type = p.event_type
      ORDER BY c.total_count DESC
      LIMIT 20
    `, params);

    const recentEvents = eventRows.map(r => {
      const count = parseInt(r.total_count, 10);
      const prevCount = parseInt(r.prev_count, 10);
      const deltaPct = prevCount > 0 ? ((count - prevCount) / prevCount) * 100 : 0;
      
      return {
        id: `event-${r.event_type}`,
        name: r.event_type,
        count,
        uniqueDevices: parseInt(r.unique_devices, 10),
        deltaPct,
      };
    });

    const result = {
      dailyInstalls,
      hourlyHeartbeats,
      geoBreakdown,
      recentEvents,
    };

    analyticsCache.set(cacheKey, result, 300); // 5 min cache
    return result;
  } catch (err) {
    console.error('getGlobalAnalyticsOverview query failed:', err);
    return {
      dailyInstalls: [],
      hourlyHeartbeats: [],
      geoBreakdown: [],
      recentEvents: [],
    };
  }
}

/**
 * Get crash analytics for an app
 */
export async function getCrashAnalytics(
  appId: string,
  range: '7d' | '24h' | '30d' = '7d'
): Promise<{
  total_crashes: number;
  crash_rate: number;
  trend: Array<{ t: number; v: number }>;
  by_type: Array<{ type: string; count: number; pct: number }>;
}> {
  const cacheKey = `crash-analytics:${appId}:${range}`;
  const cached = analyticsCache.get<any>(cacheKey);
  if (cached) return cached;

  const rangeDays = range === '24h' ? 1 : range === '7d' ? 7 : 30;

  try {
    // Get total crashes and installs for crash rate calculation
    const { rows: summaryRows } = await query<{ 
      total_crashes: string;
      total_sessions: string;
    }>(`
      SELECT 
        SUM(CASE WHEN event_type = 'crash' THEN event_count ELSE 0 END)::bigint as total_crashes,
        SUM(CASE WHEN event_type = 'heartbeat' THEN unique_devices ELSE 0 END)::bigint as total_sessions
      FROM analytics_hourly_rollups
      WHERE app_id = $1
        AND hour_bucket >= NOW() - INTERVAL '${rangeDays} days'
    `, [appId]);

    const totalCrashes = parseInt(summaryRows[0]?.total_crashes || '0', 10);
    const totalSessions = parseInt(summaryRows[0]?.total_sessions || '0', 10);
    const crashRate = totalSessions > 0 ? (totalCrashes / totalSessions) * 100 : 0;

    // Get crash trend (daily)
    const { rows: trendRows } = await query<{ day: Date; crash_count: number }>(`
      SELECT 
        DATE_TRUNC('day', hour_bucket) as day,
        SUM(event_count)::bigint as crash_count
      FROM analytics_hourly_rollups
      WHERE app_id = $1
        AND event_type = 'crash'
        AND hour_bucket >= NOW() - INTERVAL '${rangeDays} days'
      GROUP BY day
      ORDER BY day ASC
    `, [appId]);

    const trend = trendRows.map(r => ({
      t: r.day.getTime(),
      v: r.crash_count,
    }));

    // Get crash breakdown by type (from raw events for detailed info)
    const { rows: typeRows } = await query<{ crash_type: string; type_count: string }>(`
      SELECT 
        COALESCE(data->>'crash_type', 'unknown') as crash_type,
        COUNT(*)::bigint as type_count
      FROM analytics_events
      WHERE app_id = $1
        AND event_type = 'crash'
        AND timestamp >= NOW() - INTERVAL '${rangeDays} days'
      GROUP BY crash_type
      ORDER BY type_count DESC
      LIMIT 10
    `, [appId]);

    const by_type = typeRows.map(r => {
      const count = parseInt(r.type_count, 10);
      return {
        type: r.crash_type,
        count,
        pct: totalCrashes > 0 ? (count / totalCrashes) * 100 : 0,
      };
    });

    const result = {
      total_crashes: totalCrashes,
      crash_rate: crashRate,
      trend,
      by_type,
    };

    analyticsCache.set(cacheKey, result, 120); // 2 min cache
    return result;
  } catch (err) {
    console.error('getCrashAnalytics query failed:', err);
    return {
      total_crashes: 0,
      crash_rate: 0,
      trend: [],
      by_type: [],
    };
  }
}

/**
 * Get campaign error breakdown
 */
export async function getCampaignErrors(
  campaignId: string
): Promise<{
  total: number;
  by_code: Array<{ code: string; count: number; message: string; pct: number }>;
}> {
  const cacheKey = `campaign-errors:${campaignId}`;
  const cached = analyticsCache.get<any>(cacheKey);
  if (cached) return cached;

  try {
    // Query campaign_notifications for errors
    const { rows: errorRows } = await query<{ 
      error_code: string; 
      error_message: string;
      error_count: string;
    }>(`
      SELECT 
        COALESCE(error_code, 'unknown') as error_code,
        COALESCE(error_message, 'No error message') as error_message,
        COUNT(*)::bigint as error_count
      FROM campaign_notifications
      WHERE campaign_id = $1
        AND status = 'failed'
      GROUP BY error_code, error_message
      ORDER BY error_count DESC
    `, [campaignId]);

    const total = errorRows.reduce((sum, r) => sum + parseInt(r.error_count, 10), 0);

    const by_code = errorRows.map(r => {
      const count = parseInt(r.error_count, 10);
      return {
        code: r.error_code,
        count,
        message: r.error_message,
        pct: total > 0 ? (count / total) * 100 : 0,
      };
    });

    const result = {
      total,
      by_code,
    };

    analyticsCache.set(cacheKey, result, 60); // 1 min cache
    return result;
  } catch (err) {
    console.error('getCampaignErrors query failed:', err);
    return {
      total: 0,
      by_code: [],
    };
  }
}
