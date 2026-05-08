import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Run all pending migrations
 */
export async function runMigrations(databaseUrl?: string): Promise<void> {
  console.log('🔄 Running database migrations...');

  // Create migrations tracking table if it doesn't exist
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Get applied migrations
  const { rows: applied } = await query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const appliedVersions = new Set(applied.map(r => r.version));

  // Get all migration files
  const files = await fs.readdir(MIGRATIONS_DIR);
  const migrations = files
    .filter(f => f.endsWith('.sql'))
    .sort();

  let appliedCount = 0;

  for (const file of migrations) {
    const version = file.replace('.sql', '');
    
    if (appliedVersions.has(version)) {
      console.log(`  ✓ ${version} (already applied)`);
      continue;
    }

    console.log(`  ▶ Applying ${version}...`);
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');

    try {
      await query(sql);
      await query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      console.log(`  ✓ ${version} applied`);
      appliedCount++;
    } catch (err) {
      console.error(`  ✗ ${version} failed:`, err);
      throw err;
    }
  }

  if (appliedCount === 0) {
    console.log('✅ No pending migrations');
  } else {
    console.log(`✅ Applied ${appliedCount} migration(s)`);
  }
}
