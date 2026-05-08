import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { ApkZioStore } from './store.js';
import { query, closePool } from './db.js';

const TEST_DATABASE = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const USE_DB = !!TEST_DATABASE;

describe('ApkZioStore - Database Persistence', () => {
  let store: ApkZioStore;

  beforeAll(async () => {
    if (USE_DB) {
      // Run migrations if needed
      const { runMigrations } = await import('./migrate.js');
      await runMigrations();
    }
    store = new ApkZioStore('test-key', USE_DB);
  });

  afterEach(async () => {
    if (USE_DB) {
      // Clean up test data
      await query('DELETE FROM android_apps WHERE name LIKE $1', ['Test%']);
    }
  });

  it('should create and retrieve an app', async () => {
    const app = await store.createApp({
      name: 'Test App',
      package_name: `com.test.app.${Date.now()}`,
      owner_id: 'test-owner',
      icon_glyph: 'TA',
      icon_color: 'from-blue-500/20 to-blue-500/5',
    });

    expect(app.id).toBeDefined();
    expect(app.name).toBe('Test App');
    expect(app.app_key).toMatch(/^pk_/);

    const apps = await store.listApps();
    const found = apps.find(a => a.id === app.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe('Test App');
  });

  it('should update an app', async () => {
    const app = await store.createApp({
      name: 'Test App Update',
      package_name: `com.test.update.${Date.now()}`,
      owner_id: 'test-owner',
    });

    const updated = await store.updateApp(app.id, {
      name: 'Updated Name',
      status: 'paused',
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.status).toBe('paused');
  });

  it('should delete an app', async () => {
    const app = await store.createApp({
      name: 'Test App Delete',
      package_name: `com.test.delete.${Date.now()}`,
      owner_id: 'test-owner',
    });

    const deleted = await store.deleteApp(app.id);
    expect(deleted).toBe(true);

    const apps = await store.listApps();
    const found = apps.find(a => a.id === app.id);
    expect(found).toBeUndefined();
  });

  it('should find app by key', async () => {
    const app = await store.createApp({
      name: 'Test App Key',
      package_name: `com.test.key.${Date.now()}`,
      owner_id: 'test-owner',
    });

    const found = await store.findAppByKey(app.app_key);
    expect(found).toBeDefined();
    expect(found?.id).toBe(app.id);
  });

  it('should create a campaign', async () => {
    const app = await store.createApp({
      name: 'Test Campaign App',
      package_name: `com.test.campaign.${Date.now()}`,
      owner_id: 'test-owner',
    });

    const campaign = await store.createCampaign({
      app_id: app.id,
      title: 'Test Campaign',
      body: 'Test body',
      target_type: 'all',
    });

    expect(campaign.id).toBeDefined();
    expect(campaign.title).toBe('Test Campaign');
    expect(campaign.status).toBe('draft');
  });

  if (USE_DB) {
    afterAll(async () => {
      await closePool();
    });
  }
});
