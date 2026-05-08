# Async/Await Migration TODO

This document tracks the remaining work to fully convert the codebase to use async/await with the database-backed store.

## Status

✅ Core implementation complete:
- Database connection and pooling
- Migration system
- All store methods converted to async
- Documentation and tests

⚠️ Route handlers need conversion: ~40 TypeScript errors

## Files Requiring Updates

### 1. `src/server.ts` (Priority: HIGH)

Route handlers that need `async` keyword and `await` on store calls:

#### Apps Routes
- [x] `GET /api/apps` - FIXED
- [x] `POST /api/apps` - FIXED  
- [ ] `GET /api/apps/:appId` - needs await on store.apps.get()
- [ ] `PATCH /api/apps/:appId` - needs await on store.updateApp()
- [ ] `DELETE /api/apps/:appId` - needs await on store.deleteApp()

#### Campaigns Routes (lines ~380-470)
- [ ] `GET /api/apps/:appId/campaigns`
- [ ] `POST /api/apps/:appId/campaigns`
- [ ] `POST /api/campaigns/:id/send`
- [ ] `POST /api/campaigns/:id/pause`
- [ ] `POST /api/campaigns/:id/cancel`
- [ ] `POST /api/campaigns/:id/duplicate`

#### Devices & Subscribers Routes (lines ~500-600)
- [ ] `GET /api/apps/:appId/devices`
- [ ] `GET /api/apps/:appId/subscribers`
- [ ] `PATCH /api/subscribers/:id`

#### API Keys Routes (lines ~650-750)
- [ ] `POST /api/apps/:appId/keys`
- [ ] `PATCH /api/keys/:id`
- [ ] `POST /api/keys/:id/revoke`

#### Builds Routes (lines ~800-900)
- [ ] `GET /api/apps/:appId/builds`
- [ ] `POST /api/apps/:appId/builds`
- [ ] `GET /api/builds/:id`
- [ ] `GET /api/builds/:id/logs`

#### SDK Routes (lines ~1200-1400)
- [ ] `POST /api/sdk/init`
- [ ] `POST /api/sdk/register`
- [ ] `POST /api/sdk/heartbeat`
- [ ] `POST /api/sdk/events`

### 2. Test Files (Priority: MEDIUM)

Files with test failures due to missing await:

- `src/campaign-send.test.ts` - lines 19-45
- `src/admin-clients-api.test.ts` - needs async setup

### 3. Helper Functions (Priority: LOW)

Functions that call store methods internally:

- `recalcAppMetrics()` if called from sync context
- Any utility functions calling store

## Migration Pattern

### Before (Sync)
```typescript
app.get("/api/apps", (_req, res) => {
  const apps = store.listApps();
  ok(res, { ok: true, apps });
});
```

### After (Async)
```typescript
app.get("/api/apps", async (_req, res) => {
  const apps = await store.listApps();
  ok(res, { ok: true, apps });
});
```

### For Error Handlers
```typescript
app.post("/api/apps", async (req, res) => {
  try {
    const app = await store.createApp(req.body);
    ok(res, { app });
  } catch (err) {
    err(res, "create_failed", err.message, 400);
  }
});
```

## Testing Strategy

1. **Unit Tests**: Run `npm test` after each file update
2. **Integration**: Test each endpoint with curl/Postman
3. **E2E**: Run full workflow (SDK → dashboard → campaigns)

### Test Commands
```bash
# Run all tests
npm test

# Test specific file
npm test src/campaign-send.test.ts

# Type check only
npm run lint
```

## Progress Tracking

Update this checklist as routes are converted:

- [ ] Apps routes (5 endpoints)
- [ ] Campaigns routes (6 endpoints)
- [ ] Devices routes (3 endpoints)
- [ ] API Keys routes (3 endpoints)
- [ ] Builds routes (4 endpoints)
- [ ] SDK routes (4 endpoints)
- [ ] Test files (2 files)

## Estimated Effort

- **Time**: 2-3 hours for mechanical changes
- **Difficulty**: Low (repetitive pattern)
- **Risk**: Low (TypeScript catches errors)

## Notes

- All changes are mechanical (add `async` + `await`)
- TypeScript will catch missing awaits
- No business logic changes needed
- Can be done incrementally per route group
- Database mode works when USE_DATABASE=true
- In-memory mode still works when USE_DATABASE=false

## Related Files

- `src/store.ts` - Core store implementation ✅
- `src/db.ts` - Database connection ✅
- `src/migrate.ts` - Migration runner ✅
- `DATABASE.md` - Usage documentation ✅
