#!/usr/bin/env tsx

import { query, closePool } from '../src/db.js';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create demo app
    const { rows: [app] } = await query<{ id: string; name: string }>(`
      INSERT INTO android_apps (
        owner_id, name, package_name, app_key, icon_glyph, icon_color, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      ON CONFLICT (package_name) DO NOTHING
      RETURNING id, name
    `, [
      'owner-1',
      'Demo App',
      'com.apkzio.demo',
      'app_demo123',
      'DA',
      'from-blue-500/20 to-blue-500/5'
    ]);

    if (app) {
      console.log(`✓ Created app: ${app.name} (${app.id})`);

      // Create demo campaign
      await query(`
        INSERT INTO push_campaigns (
          app_id, title, body, status, target_type, target_summary
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [
        app.id,
        'Welcome Campaign',
        'Welcome to our app!',
        'draft',
        'all',
        'All devices'
      ]);
      console.log('✓ Created demo campaign');

      // Create demo devices
      for (let i = 0; i < 10; i++) {
        await query(`
          INSERT INTO devices (
            app_id, install_hash, manufacturer, model, os_version, country_code, app_version
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (app_id, install_hash) DO NOTHING
        `, [
          app.id,
          `install-${i}`,
          'Google',
          'Pixel 7',
          '14',
          'US',
          '1.0.0'
        ]);
      }
      console.log('✓ Created 10 demo devices');

      // Create demo subscribers
      for (let i = 0; i < 10; i++) {
        await query(`
          INSERT INTO push_subscribers (
            app_id, fcm_token, fcm_token_redacted, is_valid
          )
          VALUES ($1, $2, $3, true)
          ON CONFLICT (app_id, fcm_token) DO NOTHING
        `, [
          app.id,
          `fcm_token_${i}_${Date.now()}`,
          `fcm_****${i}`
        ]);
      }
      console.log('✓ Created 10 demo subscribers');
    } else {
      console.log('ℹ Demo app already exists, skipping seed');
    }

    console.log('✅ Seeding complete');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

seed();
