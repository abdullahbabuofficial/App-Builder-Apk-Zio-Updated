# ApkZio Admin Console

> Signal Console — warm-dark, acid-lime admin UI for push notifications at scale.

## Quick start

```bash
pnpm install && pnpm dev   # http://localhost:5173
```

Optional — live backend (`backends/local-api`): copy `.env.example` to `.env`, set `VITE_APKZIO_API_URL=http://localhost:8787`, run the API from `../backends/local-api`, then restart Vite.

Demo auth: any email + any password (localStorage flag).

## Stack

React 18 · TypeScript · Vite · Tailwind 3.4 · React Router 6  
Fonts: Newsreader (serif) + Geist (body) + Geist Mono (data)  
Charts: custom SVG — zero chart-library deps

## 13 Pages

`/sign-in` · `/dashboard` · `/apps` · `/apps/:id` · `/apps/:id/devices` · `/apps/:id/subscribers` · `/campaigns` · `/campaigns/new` · `/campaigns/:id` · `/analytics` · `/builder` · `/keys` · `/settings`

## Wire to Supabase backend

Replace mock-data.ts imports with fetch to Edge Functions at `https://<ref>.supabase.co/functions/v1/`.  
Backend delivered separately in `apkzio-backend/`.

## Deploy

```bash
pnpm build   # → dist/  — deploy to Vercel / Cloudflare Pages / any static host
```

## Environment & data routing

| Variable | Purpose |
|----------|---------|
| `VITE_APKZIO_API_URL` | Base URL for the ApkZio REST API (no trailing slash). Required when using REST-backed lists. |
| `VITE_APKZIO_DATA_SOURCE` | `auto` \| `rest` \| `supabase` \| `mock` — picks where dashboard entities load from while Supabase Auth can stay enabled. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Browser Supabase client for sign-in and optional Postgres (RLS) data. |

REST requests use a configurable timeout, limited retries on 5xx, and attach the Supabase session JWT as `Authorization: Bearer` when configured in the app shell.

Operational scripts (e.g. creating dashboard users) belong with backend tooling — keep **service role** keys out of the Vite `.env`; use them only in trusted server-side scripts or Edge Functions.
