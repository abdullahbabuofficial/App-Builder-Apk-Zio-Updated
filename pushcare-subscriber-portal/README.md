# PushCare — Subscriber Preferences Portal

A tiny static site that lets the **end users of apps using PushCare** manage
the notifications they receive. This is the page someone lands on when they
tap "manage notification preferences" inside an Android app.

It is *not* the customer console — that's `pushcare-admin` next door.

## What you can do here

- See which app you're subscribed to and when the subscription started
- Pause notifications for 1h / 1d / 1w / forever
- Toggle categories: Promotional, Alerts, Transactional, News & updates
- Delete your device record (right-to-be-forgotten)

## URL shape

```
https://pushcare-subscriber.example.com/preferences?token=<JWT>
```

The token is signed **server-side by the Android SDK** with claims:

```json
{ "app_id": "...", "device_id": "...", "exp": 1735689600 }
```

The SDK builds this URL inside the host app and opens it in the system
browser when the user taps "manage preferences". See the SDK docs in
`pushcare-admin/scripts/` for the signing helper and the request the SDK
should make to the server.

## Why we don't verify the JWT in the browser

This site is a static bundle. Verifying the signature would mean shipping
the server's verification key to every visitor, which buys nothing — every
mutation (pause, set categories, delete) hits the PushCare API and the
**server** reverifies the JWT on each request. That's where authorization
actually happens.

We decode the payload here purely for display ("which app is this for?")
and to redirect the user to an error page if `exp` is in the past.

## Development

```bash
npm install
npm run dev    # http://localhost:5174
```

Port 5174 is intentional — `pushcare-admin` already uses 5173.

Without a backend the page falls back to a small mock so designers can
click through it. Set `VITE_PUSHCARE_API_URL` in `.env` to point at a real
PushCare server; see `.env.example`.

## Build & deploy

```bash
npm run build  # outputs to ./dist
```

The `dist/` folder is plain static HTML/JS/CSS. Drop it on any static host:

- **Vercel** — `vercel deploy`
- **Cloudflare Pages** — connect the repo, build cmd `npm run build`,
  output dir `dist`
- **Netlify** — same idea

You'll also need a SPA fallback rule so `/preferences` rewrites to
`index.html` (Vercel does this automatically; CF Pages: add a `_redirects`
file with `/* /index.html 200`).

## TODO — wiring up the real backend

These endpoints currently log to the console and return optimistic success.
They need to land in `pushcare-server`:

- [ ] `GET  /api/preferences/:token` — verify JWT, return app metadata,
      device subscribed-at, current pause state, category booleans.
- [ ] `POST /api/preferences/:token/pause` — body `{ duration }`, sets
      `paused_until` on the device row.
- [ ] `POST /api/preferences/:token/categories` — body `{ categories }`,
      replaces the device's category opt-ins. Probably worth making the
      list of available categories *server-driven per app* so different
      operators can name them differently.
- [ ] `POST /api/preferences/:token/delete` — hard-deletes the device row
      and any per-device events. Idempotent.
- [ ] CORS must allow the portal's origin for all of the above.

## File map

```
src/
├── App.tsx                     route table + page frame
├── main.tsx                    React root
├── components/
│   ├── AppHeader.tsx           app icon + name + subscribed-since
│   ├── Button.tsx              primary / secondary / ghost / danger
│   ├── Card.tsx                surface container, with danger tone
│   ├── CategoryToggle.tsx      whole-row click target around a Switch
│   ├── ConfirmModal.tsx        ESC-closable confirm dialog
│   ├── PauseControl.tsx        5-option segmented control
│   └── Switch.tsx              self-contained toggle
├── lib/
│   ├── api.ts                  fetch wrappers + mock fallback
│   ├── format.ts               relTime, dateTime
│   ├── icons.tsx               ~9 inline SVG glyphs
│   └── token.ts                client-side JWT decode (no verify)
├── pages/
│   ├── DeletedConfirmation.tsx
│   ├── ErrorPage.tsx
│   ├── Landing.tsx
│   ├── PausedConfirmation.tsx
│   └── Preferences.tsx
└── styles/
    └── globals.css
```
