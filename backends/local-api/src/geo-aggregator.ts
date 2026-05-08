/**
 * Geographic Breakdown Aggregator
 * 
 * Provides country-level breakdowns from aggregated analytics data
 */

import { query } from './db.js';

export interface GeoBreakdownItem {
  country: string;
  count: number;
}

/**
 * Get geographic breakdown for an app's heartbeat activity
 * 
 * @param appId - Application UUID
 * @param range - Time range: '24h', '7d', '30d', '90d'
 * @returns Array of country codes with event counts
 */
export async function getGeoBreakdown(
  appId: string,
  range: string = '7d'
): Promise<GeoBreakdownItem[]> {
  // Convert range to PostgreSQL interval
  const intervalMap: Record<string, string> = {
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days',
    '90d': '90 days',
  };
  
  const interval = intervalMap[range] || '7 days';
  
  try {
    const { rows } = await query<{ country_code: string; total_count: string }>(`
      SELECT 
        country_code,
        SUM(event_count)::bigint as total_count
      FROM analytics_hourly_rollups
      WHERE app_id = $1 
        AND event_type = 'heartbeat'
        AND hour_bucket >= NOW() - INTERVAL '${interval}'
      GROUP BY country_code
      ORDER BY total_count DESC
      LIMIT 20
    `, [appId]);
    
    return rows.map(r => ({
      country: r.country_code || 'unknown',
      count: parseInt(r.total_count, 10),
    }));
  } catch (err) {
    console.error('Geo breakdown query failed:', err);
    return [];
  }
}

/**
 * Get geo breakdown from country_breakdown JSONB column
 * (Alternative method using pre-aggregated country data)
 */
export async function getGeoBreakdownFromJson(
  appId: string,
  range: string = '7d'
): Promise<GeoBreakdownItem[]> {
  const intervalMap: Record<string, string> = {
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days',
    '90d': '90 days',
  };
  
  const interval = intervalMap[range] || '7 days';
  
  try {
    const { rows } = await query<{ country_breakdown: any }>(`
      SELECT 
        country_breakdown
      FROM analytics_hourly_rollups
      WHERE app_id = $1 
        AND event_type = 'heartbeat'
        AND hour_bucket >= NOW() - INTERVAL '${interval}'
        AND country_breakdown IS NOT NULL
    `, [appId]);
    
    // Merge all country breakdowns
    const countryMap = new Map<string, number>();
    
    for (const row of rows) {
      if (row.country_breakdown) {
        for (const [country, count] of Object.entries(row.country_breakdown)) {
          const current = countryMap.get(country) || 0;
          countryMap.set(country, current + (count as number));
        }
      }
    }
    
    // Convert to array and sort
    return Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  } catch (err) {
    console.error('Geo breakdown from JSON query failed:', err);
    return [];
  }
}

/**
 * Get geographic breakdown for all event types
 */
export async function getGeoBreakdownByEvent(
  appId: string,
  eventType: string,
  range: string = '7d'
): Promise<GeoBreakdownItem[]> {
  const intervalMap: Record<string, string> = {
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days',
    '90d': '90 days',
  };
  
  const interval = intervalMap[range] || '7 days';
  
  try {
    const { rows } = await query<{ country_breakdown: any }>(`
      SELECT 
        country_breakdown
      FROM analytics_hourly_rollups
      WHERE app_id = $1 
        AND event_type = $2
        AND hour_bucket >= NOW() - INTERVAL '${interval}'
        AND country_breakdown IS NOT NULL
    `, [appId, eventType]);
    
    const countryMap = new Map<string, number>();
    
    for (const row of rows) {
      if (row.country_breakdown) {
        for (const [country, count] of Object.entries(row.country_breakdown)) {
          const current = countryMap.get(country) || 0;
          countryMap.set(country, current + (count as number));
        }
      }
    }
    
    return Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  } catch (err) {
    console.error('Geo breakdown by event query failed:', err);
    return [];
  }
}
