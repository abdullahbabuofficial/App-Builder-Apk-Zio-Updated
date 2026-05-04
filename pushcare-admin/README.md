# PushCare Admin Console

> Signal Console — warm-dark, acid-lime admin UI for push notifications at scale.

## Quick start

```bash
pnpm install && pnpm dev   # http://localhost:5173
```

Optional — live backend (`backends/local-api`): copy `.env.example` to `.env`, set `VITE_PUSHCARE_API_URL=http://localhost:8787`, run the API from `../backends/local-api`, then restart Vite.

Demo auth: any email + any password (localStorage flag).

## Stack

React 18 · TypeScript · Vite · Tailwind 3.4 · React Router 6  
Fonts: Newsreader (serif) + Geist (body) + Geist Mono (data)  
Charts: custom SVG — zero chart-library deps

## 13 Pages

`/sign-in` · `/dashboard` · `/apps` · `/apps/:id` · `/apps/:id/devices` · `/apps/:id/subscribers` · `/campaigns` · `/campaigns/new` · `/campaigns/:id` · `/analytics` · `/builder` · `/keys` · `/settings`

## Wire to Supabase backend

Replace mock-data.ts imports with fetch to Edge Functions at `https://<ref>.supabase.co/functions/v1/`.  
Backend delivered separately in `pushcare-backend/`.

## Deploy

```bash
pnpm build   # → dist/  — deploy to Vercel / Cloudflare Pages / any static host
```
