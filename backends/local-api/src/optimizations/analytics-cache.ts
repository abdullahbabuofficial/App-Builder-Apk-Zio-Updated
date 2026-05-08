/**
 * Optimized Analytics Queries with Redis Caching
 * 
 * Provides cached dashboard metrics and analytics data
 */

import { cached, cache } from '../cache/redis-cache.js';
import { query } from '../db.js';
import { logger } from '../monitoring/logger.js';

/**
 * Get dashboard metrics with 5-minute cache
 */
export async function getDashboardMetrics(appId: string) {
  return cached(`dashboard:${appId}`, 300, async () => {
    logger.debug(`Fetching dashboard metrics for app ${appId}`);
    
    const { rows } = await query(`
      SELECT 
        COUNT(DISTINCT device_id) as active_devices,
        SUM(CASE WHEN event_type = 'install' THEN 1 ELSE 0 END) as installs,
        SUM(CASE WHEN event_type = 'uninstall' THEN 1 ELSE 0 END) as uninstalls,
        SUM(CASE WHEN event_type = 'crash' THEN 1 ELSE 0 END) as crashes,
        SUM(CASE WHEN event_type = 'heartbeat' THEN 1 ELSE 0 END) as heartbeats
      FROM analytics_events
      WHERE app_id = $1 
        AND timestamp > NOW() - INTERVAL '24 hours'
    `, [appId]);
    
    return rows[0];
  });
}

/**
 * Get app list with 2-minute cache
 */
export async function getCachedAppList(userId: string) {
  return cached(`apps:user:${userId}`, 120, async () => {
    const { rows } = await query(`
      SELECT 
        id,
        package_name,
        app_name,
        version_code,
        version_name,
        created_at,
        status
      FROM android_apps
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
    
    return rows;
  });
}

/**
 * Get daily analytics with 10-minute cache
 */
export async function getDailyAnalytics(appId: string, days: number = 30) {
  return cached(`analytics:daily:${appId}:${days}`, 600, async () => {
    const { rows } = await query(`
      SELECT 
        DATE(timestamp) as date,
        event_type,
        COUNT(*) as count,
        COUNT(DISTINCT device_id) as unique_devices
      FROM analytics_events
      WHERE app_id = $1
        AND timestamp > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(timestamp), event_type
      ORDER BY date DESC, event_type
    `, [appId]);
    
    return rows;
  });
}

/**
 * Get geographic distribution with 15-minute cache
 */
export async function getGeographicDistribution(appId: string) {
  return cached(`analytics:geo:${appId}`, 900, async () => {
    const { rows } = await query(`
      SELECT 
        country_code,
        COUNT(*) as event_count,
        COUNT(DISTINCT device_id) as unique_devices,
        SUM(CASE WHEN event_type = 'install' THEN 1 ELSE 0 END) as installs
      FROM analytics_events
      WHERE app_id = $1
        AND timestamp > NOW() - INTERVAL '30 days'
        AND country_code IS NOT NULL
      GROUP BY country_code
      ORDER BY event_count DESC
      LIMIT 50
    `, [appId]);
    
    return rows;
  });
}

/**
 * Get campaign statistics with 5-minute cache
 */
export async function getCampaignStats(campaignId: string) {
  return cached(`campaign:stats:${campaignId}`, 300, async () => {
    const { rows } = await query(`
      SELECT 
        campaign_id,
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN opened_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (opened_at - sent_at)) 
          ELSE NULL END) as avg_open_time_seconds
      FROM push_notifications
      WHERE campaign_id = $1
      GROUP BY campaign_id
    `, [campaignId]);
    
    return rows[0] || null;
  });
}

/**
 * Get subscriber count with 1-minute cache
 */
export async function getSubscriberCount(appId: string) {
  return cached(`subscribers:count:${appId}`, 60, async () => {
    const { rows } = await query(`
      SELECT COUNT(*) as count
      FROM device_subscriptions
      WHERE app_id = $1 
        AND is_active = true
    `, [appId]);
    
    return parseInt(rows[0].count, 10);
  });
}

/**
 * Invalidate all cache for a specific app
 */
export async function invalidateAppCache(appId: string) {
  logger.info(`Invalidating cache for app ${appId}`);
  
  const patterns = [
    `dashboard:${appId}`,
    `analytics:*:${appId}*`,
    `campaign:*:${appId}*`,
    `subscribers:*:${appId}*`,
  ];
  
  let totalDeleted = 0;
  for (const pattern of patterns) {
    const deleted = await cache.delPattern(pattern);
    totalDeleted += deleted;
  }
  
  logger.info(`Invalidated ${totalDeleted} cache entries for app ${appId}`);
}

/**
 * Invalidate cache for a user
 */
export async function invalidateUserCache(userId: string) {
  logger.info(`Invalidating cache for user ${userId}`);
  await cache.del(`apps:user:${userId}`);
}

/**
 * Warm up cache for an app (pre-populate common queries)
 */
export async function warmupCache(appId: string) {
  logger.info(`Warming up cache for app ${appId}`);
  
  try {
    await Promise.all([
      getDashboardMetrics(appId),
      getDailyAnalytics(appId, 30),
      getGeographicDistribution(appId),
      getSubscriberCount(appId),
    ]);
    
    logger.info(`Cache warmup completed for app ${appId}`);
  } catch (err) {
    logger.error(`Cache warmup failed for app ${appId}:`, err);
  }
}
