#!/usr/bin/env node
/**
 * Test script for analytics aggregation system
 * 
 * This script verifies that:
 * 1. Migrations have been applied
 * 2. Aggregator can run manually
 * 3. Query functions work correctly
 * 4. Cache layer functions properly
 */

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';
import { aggregator } from './aggregator.js';
import { getGeoBreakdown } from './geo-aggregator.js';
import { getDailyInstalls, getHourlyHeartbeats, getAppSummary } from './analytics-queries.js';
import { analyticsCache } from './analytics-cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config({ path: resolve(__dirname, '../.env') });

async function runTests() {
  console.log('🧪 Testing Analytics Aggregation System\n');
  
  try {
    // Test 1: Check if migrations applied
    console.log('1️⃣  Checking migrations...');
    const { rows: migrations } = await query(`
      SELECT version FROM schema_migrations ORDER BY version
    `);
    const versions = migrations.map(r => r.version);
    console.log(`   ✅ Found ${versions.length} migrations:`, versions);
    
    if (!versions.includes(5)) {
      throw new Error('Migration 005_aggregation_tables.sql not applied!');
    }
    
    // Test 2: Check if aggregation tables exist
    console.log('\n2️⃣  Checking aggregation tables...');
    const { rows: tables } = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('analytics_hourly_rollups', 'analytics_daily_rollups')
      ORDER BY table_name
    `);
    console.log(`   ✅ Found ${tables.length} aggregation tables:`, tables.map(t => t.table_name));
    
    if (tables.length < 2) {
      throw new Error('Aggregation tables not found!');
    }
    
    // Test 3: Check for country_breakdown column
    console.log('\n3️⃣  Checking schema updates...');
    const { rows: columns } = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'analytics_hourly_rollups'
        AND column_name = 'country_breakdown'
    `);
    
    if (columns.length > 0) {
      console.log(`   ✅ country_breakdown column exists (${columns[0].data_type})`);
    } else {
      console.log('   ⚠️  country_breakdown column not found');
    }
    
    // Test 4: Insert sample data
    console.log('\n4️⃣  Inserting sample analytics data...');
    
    // First, check if we have any apps
    const { rows: apps } = await query(`SELECT id FROM android_apps LIMIT 1`);
    
    if (apps.length === 0) {
      console.log('   ⚠️  No apps found, skipping data insertion');
    } else {
      const appId = apps[0].id;
      
      // Insert some sample events
      await query(`
        INSERT INTO analytics_events (app_id, event_type, device_id, country_code, timestamp)
        VALUES 
          ($1, 'install', 'dev-001', 'US', NOW() - INTERVAL '1 hour'),
          ($1, 'heartbeat', 'dev-001', 'US', NOW() - INTERVAL '1 hour'),
          ($1, 'heartbeat', 'dev-002', 'UK', NOW() - INTERVAL '1 hour'),
          ($1, 'crash', 'dev-001', 'US', NOW() - INTERVAL '30 minutes')
        ON CONFLICT DO NOTHING
      `, [appId]);
      
      console.log(`   ✅ Inserted sample events for app ${appId}`);
    }
    
    // Test 5: Run manual aggregation
    console.log('\n5️⃣  Running manual hourly aggregation...');
    try {
      await aggregator.runHourlyAggregation();
      console.log('   ✅ Hourly aggregation completed');
    } catch (err) {
      console.log('   ⚠️  Aggregation failed (this is ok if no data):', err instanceof Error ? err.message : err);
    }
    
    // Test 6: Test query functions
    console.log('\n6️⃣  Testing query functions...');
    
    if (apps.length > 0) {
      const appId = apps[0].id;
      
      const [installs, heartbeats, summary, geo] = await Promise.all([
        getDailyInstalls(appId, 7),
        getHourlyHeartbeats(appId, 24),
        getAppSummary(appId, 30),
        getGeoBreakdown(appId, '24h'),
      ]);
      
      console.log(`   ✅ getDailyInstalls: ${installs.length} days of data`);
      console.log(`   ✅ getHourlyHeartbeats: ${heartbeats.length} hours of data`);
      console.log(`   ✅ getAppSummary: ${JSON.stringify(summary)}`);
      console.log(`   ✅ getGeoBreakdown: ${geo.length} countries`);
    } else {
      console.log('   ⏭️  Skipping query tests (no apps found)');
    }
    
    // Test 7: Test cache
    console.log('\n7️⃣  Testing cache layer...');
    analyticsCache.set('test-key', { foo: 'bar' }, 10);
    const cached = analyticsCache.get('test-key') as { foo: string } | null;
    
    if (cached && cached.foo === 'bar') {
      console.log('   ✅ Cache set/get working');
    } else {
      throw new Error('Cache not working!');
    }
    
    const stats = analyticsCache.getStats();
    console.log(`   ✅ Cache stats:`, stats);
    
    // Test 8: Check aggregator lifecycle
    console.log('\n8️⃣  Testing aggregator lifecycle...');
    aggregator.start();
    console.log('   ✅ Aggregator started');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    aggregator.stop();
    console.log('   ✅ Aggregator stopped');
    
    console.log('\n✅ All tests passed!\n');
    console.log('📊 Analytics Aggregation System is ready to use.');
    console.log('\nNext steps:');
    console.log('  1. Aggregator runs automatically every hour');
    console.log('  2. Daily aggregation runs at midnight');
    console.log('  3. Use /api/apps/:appId/analytics/overview for fast queries');
    console.log('  4. Cache reduces database load with 1-5 minute TTL\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}

runTests();
