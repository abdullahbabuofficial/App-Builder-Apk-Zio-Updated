#!/usr/bin/env tsx

import { query, closePool } from '../src/db.js';

async function runSecurityAudit() {
  console.log('🔒 Running security audit...\n');
  
  try {
    // Check for weak API keys
    const { rows: weakKeys } = await query(`
      SELECT COUNT(*) as count FROM api_keys
      WHERE expires_at IS NULL AND is_active = true
    `);
    console.log(`⚠️  ${weakKeys[0]?.count || 0} API keys with no expiration`);
    
    // Check for inactive admins
    const { rows: staleAdmins } = await query(`
      SELECT COUNT(*) as count FROM admin_clients
      WHERE last_seen_at < NOW() - INTERVAL '90 days'
    `);
    console.log(`⚠️  ${staleAdmins[0]?.count || 0} admin accounts inactive >90 days`);
    
    // Check for unencrypted secrets
    const secretsEnv = [
      'DATABASE_URL',
      'STRIPE_SECRET_KEY',
      'FIREBASE_SERVICE_ACCOUNT_JSON',
      'APKZIO_ADMIN_API_KEY',
    ];
    
    for (const key of secretsEnv) {
      if (!process.env[key]) {
        console.log(`❌ Missing required secret: ${key}`);
      }
    }
    
    console.log('\n✅ Security audit complete');
  } catch (err) {
    console.error('❌ Security audit failed:', err);
  } finally {
    await closePool();
  }
}

runSecurityAudit().catch(console.error);
