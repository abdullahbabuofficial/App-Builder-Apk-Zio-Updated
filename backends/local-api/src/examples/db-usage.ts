/**
 * Example usage of the ApkZio database connection module
 * Demonstrates common patterns for querying and transactions
 */

import { query, transaction, getClient, closePool } from '../db.js';

// Example 1: Simple SELECT query
export async function getApp(appId: string) {
  const result = await query(
    'SELECT * FROM android_apps WHERE id = $1',
    [appId]
  );
  return result.rows[0];
}

// Example 2: INSERT with returning
export async function createApp(ownerId: string, name: string, packageName: string, appKey: string) {
  const result = await query(
    `INSERT INTO android_apps (owner_id, name, package_name, app_key)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ownerId, name, packageName, appKey]
  );
  return result.rows[0];
}

// Example 3: UPDATE with conditions
export async function updateAppMetrics(appId: string, liveUsers: number, activeDevices: number) {
  const result = await query(
    `UPDATE android_apps 
     SET live_users = $2, active_devices_24h = $3 
     WHERE id = $1
     RETURNING *`,
    [appId, liveUsers, activeDevices]
  );
  return result.rows[0];
}

// Example 4: Complex JOIN query
export async function getCampaignsWithAppInfo(ownerId: string) {
  const result = await query(
    `SELECT 
       c.*,
       a.name as app_name,
       a.package_name
     FROM push_campaigns c
     JOIN android_apps a ON c.app_id = a.id
     WHERE a.owner_id = $1
     ORDER BY c.created_at DESC
     LIMIT 20`,
    [ownerId]
  );
  return result.rows;
}

// Example 5: Aggregation query
export async function getAppStats(appId: string) {
  const result = await query(
    `SELECT 
       COUNT(DISTINCT d.id) as total_devices,
       COUNT(DISTINCT s.id) as total_subscribers,
       COUNT(DISTINCT c.id) as total_campaigns,
       COUNT(DISTINCT b.id) as total_builds
     FROM android_apps a
     LEFT JOIN devices d ON d.app_id = a.id AND d.is_active = true
     LEFT JOIN push_subscribers s ON s.app_id = a.id AND s.is_valid = true
     LEFT JOIN push_campaigns c ON c.app_id = a.id
     LEFT JOIN apk_builds b ON b.app_id = a.id
     WHERE a.id = $1
     GROUP BY a.id`,
    [appId]
  );
  return result.rows[0];
}

// Example 6: Transaction with multiple operations
export async function createAppWithApiKey(
  ownerId: string,
  appName: string,
  packageName: string,
  appKey: string,
  apiKeyName: string,
  apiKeyHash: string,
  apiKeyPreview: string
) {
  return transaction(async (client) => {
    // Insert app
    const appResult = await client.query(
      `INSERT INTO android_apps (owner_id, name, package_name, app_key)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ownerId, appName, packageName, appKey]
    );
    const app = appResult.rows[0];

    // Insert API key
    const keyResult = await client.query(
      `INSERT INTO api_keys (app_id, name, key_hash, key_preview, scopes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [app.id, apiKeyName, apiKeyHash, apiKeyPreview, ['campaigns:read', 'campaigns:write']]
    );
    const apiKey = keyResult.rows[0];

    return { app, apiKey };
  });
}

// Example 7: Batch insert (efficient for multiple rows)
export async function trackAnalyticsEventsBatch(
  appId: string,
  events: Array<{ type: string; data: any; deviceId?: string }>
) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const event of events) {
      await client.query(
        `INSERT INTO analytics_events (app_id, event_type, event_data, device_id)
         VALUES ($1, $2, $3, $4)`,
        [appId, event.type, JSON.stringify(event.data), event.deviceId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Example 8: Using JSONB queries
export async function findEventsByData(appId: string, deviceModel: string) {
  const result = await query(
    `SELECT * FROM analytics_events
     WHERE app_id = $1 
     AND event_data->>'model' = $2
     ORDER BY timestamp DESC
     LIMIT 100`,
    [appId, deviceModel]
  );
  return result.rows;
}

// Example 9: Time-series aggregation
export async function getHourlyEventCounts(appId: string, hours: number = 24) {
  const result = await query(
    `SELECT 
       hour_bucket,
       event_type,
       event_count,
       unique_devices
     FROM analytics_hourly_rollups
     WHERE app_id = $1 
     AND hour_bucket > NOW() - INTERVAL '${hours} hours'
     ORDER BY hour_bucket DESC, event_type`,
    [appId]
  );
  return result.rows;
}

// Example 10: Pagination
export async function getDevicesPaginated(appId: string, page: number = 1, pageSize: number = 50) {
  const offset = (page - 1) * pageSize;
  
  const countResult = await query(
    'SELECT COUNT(*) FROM devices WHERE app_id = $1',
    [appId]
  );
  const totalCount = parseInt(countResult.rows[0].count);

  const dataResult = await query(
    `SELECT * FROM devices 
     WHERE app_id = $1 
     ORDER BY last_seen_at DESC 
     LIMIT $2 OFFSET $3`,
    [appId, pageSize, offset]
  );

  return {
    data: dataResult.rows,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

// Example 11: Graceful shutdown
export async function shutdown() {
  console.log('Closing database connections...');
  await closePool();
  console.log('Database connections closed');
}

// Run examples (if executed directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      console.log('Running database examples...');
      
      // Example: Create app and API key in transaction
      const { app, apiKey } = await createAppWithApiKey(
        '00000000-0000-0000-0000-000000000001',
        'Test App',
        'com.example.test',
        'test_app_key_123',
        'Main API Key',
        'hashed_key_123',
        'test_xxx...xxx'
      );
      
      console.log('Created app:', app);
      console.log('Created API key:', apiKey);
      
      // Example: Get app stats
      const stats = await getAppStats(app.id);
      console.log('App stats:', stats);
      
      await shutdown();
    } catch (err) {
      console.error('Example failed:', err);
      process.exit(1);
    }
  })();
}
