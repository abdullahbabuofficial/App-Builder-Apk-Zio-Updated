# ApkZio Admin Frontend Audit

Date: 2026-05-08

Scope: `apkzio-admin/src` pages, routing, layout, shared UI, hooks, API modules, and live/mock data behavior.

Baseline verification:

- `cd apkzio-admin && npm run build` passes.
- IDE lints report no errors under `apkzio-admin/src`.

## Executive Summary

The admin frontend is visually broad and mostly type-safe, but several areas are still incomplete at the product-behavior layer. The biggest risks are controls that look interactive but are not wired to state, routes, or API calls.

Highest-priority gaps:

- `src/components/layout/Topbar.tsx` renders local icon buttons for notifications/docs instead of the implemented `NotificationsPopover` and `DocsPopover`.
- `src/components/ui/CommandPalette.tsx` exists but is not mounted anywhere, and the visible topbar search field is not connected to it.
- `src/pages/ApiKeys.tsx` has create/edit/revoke/copy/reveal UI shells but does not call the API key functions from `src/lib/api.ts`; its reveal modal shows a hard-coded secret.
- `src/pages/Apps.tsx` exposes an `Add app` button but no create-app flow, even though `src/lib/api.ts` has app CRUD helpers.
- `src/pages/CampaignDetail.tsx` exposes pause/cancel/duplicate/send actions but does not call the matching API helpers.
- `src/pages/AppDetail.tsx` shows tabs for devices, subscribers, campaigns, events, and config, but the component renders the same overview content regardless of active tab.

## Page Findings

### Auth

- `src/pages/SignIn.tsx`
  - Password/demo sign-in is wired.
  - Missing: forgot password, create account, terms, privacy, and SSO flows.
  - The SSO button renders as an action but has no handler.

### Core Workspace

- `src/pages/Dashboard.tsx`
  - CSV export is wired.
  - Live-mode sparklines and some trend visuals render empty arrays or mock-derived patterns.
  - Needs explicit empty/error messaging for missing analytics data.

- `src/pages/Apps.tsx`
  - Grid/list, search, and app navigation are present.
  - Missing: real add-app modal and app CRUD actions.

- `src/pages/AppDetail.tsx`
  - Overview and fleet snapshot render.
  - Missing: real tab panels for devices, subscribers, campaigns, events, and config.
  - `SDK` and `Settings` buttons are visual shells.

- `src/pages/Devices.tsx`
  - Reads live/mock devices with filters and pagination.
  - Missing: CSV export and advanced filter behavior.

- `src/pages/Subscribers.tsx`
  - Reads live/mock subscribers with filters and pagination.
  - Missing: CSV export, per-row action menu, and subset handoff into the campaign wizard.

### Campaigns

- `src/pages/Campaigns.tsx`
  - List, filtering, pagination, and details navigation are present.
  - Missing: export behavior.

- `src/pages/NewCampaign.tsx`
  - Campaign creation calls `createCampaign`.
  - Risk: default demo title/body/countries can send real pushes if not changed.
  - Missing: submit loading/error state, device-list input, image URL/upload support.
  - Quiet-hours and throttle switches are hard-coded no-ops.

- `src/pages/CampaignDetail.tsx`
  - Delivery overview and payload view exist.
  - Missing: pause, cancel, duplicate, and send handlers.
  - Errors tab uses sample data until a campaign-errors API exists.
  - Payload is reconstructed by the UI, not fetched as the exact sent FCM payload.

### Analytics

- `src/pages/Analytics.tsx`
  - Overview table/chart renders.
  - Missing: export, event drill-in, and “View all” behavior.
  - Live crash rate is intentionally unavailable.

- `src/hooks/useAnalyticsOverview.ts`
  - Silently falls back to empty datasets on errors.
  - Needs loading/error state returned to pages.

### Builder

- `src/pages/ApkBuilder.tsx`
  - Most complete admin page.
  - Build creation, polling, artifact display, logs, details modal, and validation are present.
  - Copy should be kept consistent with the current “debug APK for direct install only” pipeline.

### Developer/API

- `src/pages/ApiKeys.tsx`
  - Critical incomplete module.
  - Missing: controlled create form, API call to `createApiKey`, one-time secret display from response, copy, edit, and revoke actions.
  - Current reveal modal contains a hard-coded `sk_live_...` sample secret and should not ship.

### Settings

- `src/pages/Settings.tsx`
  - Supabase profile and password update are wired.
  - Workspace/API status panel is useful.
  - Missing: avatar upload, delete account, team management, billing, webhook management.
  - Notification preferences are localStorage only.

### Operator CRM

- `src/pages/Clients.tsx`
  - REST-backed client directory exists with mock fallback.
  - Supabase mode is explicitly unsupported for client CRM.

- `src/pages/ClientDetail.tsx`
  - Needs a follow-up implementation pass for mutation/actions if this is expected to manage accounts, billing, or contact state.

### WordPress Plugins

- `src/pages/Plugins.tsx` and `src/pages/PluginDetail.tsx`
  - REST-only plugin telemetry pages are present.
  - Missing: Supabase/mock parity, richer loading states, pagination controls for connected sites, and clear unavailable states when REST is not configured.

## Cross-Cutting Module Findings

- Global search is not functional.
  - `Topbar` has a search input.
  - `CommandPalette` exists.
  - They are not connected.

- Popovers are not mounted.
  - `NotificationsPopover` and `DocsPopover` exist.
  - `Topbar` uses local `IconBtn` placeholders instead.

- Data source support is inconsistent.
  - Core workspace supports mock/rest/supabase.
  - Clients and Plugins are REST-only.
  - Some analytics behavior silently empties rather than showing API errors.

- Many actions need shared UX patterns.
  - Add `ConfirmDialog`, `ActionMenu`, `PageError`, `PageLoading`, and reusable table/export helpers.

- Admin frontend has no interaction test suite.
  - Build/typecheck passes, but no tests catch dead buttons, missing popovers, or route/tab behavior.

## Recommended Next Steps

1. Mount `NotificationsPopover`, `DocsPopover`, and `CommandPalette` in the layout/topbar.
2. Replace the topbar search input with a command-palette trigger and add `Cmd/Ctrl+K`.
3. Finish `ApiKeys` lifecycle using `createApiKey`, `updateApiKey`, and `revokeApiKey`.
4. Implement `Apps` create/edit/settings/status flows.
5. Wire `CampaignDetail` pause/cancel/duplicate/send actions.
6. Remove or disable no-op quiet-hours/throttle/device-list controls until backend support exists.
7. Split `AppDetail` tabs into real panels or route-based pages.
8. Add error/loading states to `useAnalyticsOverview` consumers.
9. Implement CSV exports consistently across Campaigns, Devices, Subscribers, and Analytics.
10. Add Playwright or React Testing Library smoke tests for routing, command palette, API key lifecycle, campaign creation, and builder flow.

