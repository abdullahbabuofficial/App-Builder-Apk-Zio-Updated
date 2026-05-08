# Enterprise Clients module — product & engineering plan

This document is the single reference for **operator-facing client CRM** (directory + 360° profile) and how it aligns with **customer-facing** (`apkzio-pub`) auth — including **Google sign-in** — without duplicate identities or ambiguous UX.

---

## 1. Goals & personas

| Persona | Needs |
|--------|--------|
| **Sales / AM** | Pipeline stages, expansion signals, contract value, stakeholders |
| **Finance / RevOps** | Invoices, payments, tax IDs, dunning, credits, usage vs entitlement |
| **Support / Success** | Apps/builds owned, tickets, contact history, health score |
| **Platform admin** | RBAC, impersonation audit, exports, region/residency flags |

---

## 2. Current implementation (repo today)

### 2.1 Public site (`apkzio-pub`)

- **Email/password**: `POST /api/auth/register`, `POST /api/auth/login` → local-api JWT session.
- **Google**: Firebase Auth popup → `POST /api/auth/google` with Firebase ID token → same JWT session shape.
- **Account linking**: Same verified Google email as an existing password user **links** `google_uid` (no duplicate user row).
- **Copy**: Login/register explain Firebase + merging — reduces “two accounts?” confusion.

### 2.2 Operator dashboard (`apkzio-admin`)

- **Clients directory**: `/clients` — status, identity (verified / Google), plan, apps/builds counts, active subscriptions, lifetime revenue (local aggregation).
- **Directory UX**: lifecycle + sign-in filters, **Export CSV**, **last active** column, sticky status column on horizontal scroll, skeleton while REST loads.
- **Client detail**: `/clients/:userId` — tabs *Overview*, *Billing*, *Apps & builds*, *Engagement* (contact form threads by email), *Enterprise roadmap* (placeholder for upcoming capabilities).
- **Mock mode**: `VITE_APKZIO_DATA_SOURCE=mock` shows **demo enterprise rows** (`admin-clients-demo.ts`) so UI density can be reviewed without API data.

### 2.3 API (`backends/local-api`)

- `GET /api/admin/clients?q=&plan=&status=&google_linked=&offset=&limit=` — paginated directory (in-memory store). `status`: `lead` \| `active` \| `churned`. `google_linked`: `true` \| `false`.
- `GET /api/admin/clients/:userId` — profile + subscriptions + payments + invoices + apps + builds + cart summary + contact messages.
- **`last_seen_at`**: updated on successful auth responses (`/api/auth/login`, `/api/auth/register`, `/api/auth/google`, `/api/auth/reset-password`), email verification, and each **`GET /api/auth/me`**. Exposed on admin summaries only (not on `publicUser` payloads).
- Routes require **admin middleware** (`security.ts`): `X-Apkzio-Admin-Key` **or** privileged local-api user when `ENFORCE_ADMIN_AUTH=1`.
- **CORS** allows `X-Apkzio-Admin-Key` from browsers.

### 2.4 Configuration clarity (avoid mismatches)

| Surface | Variable / behavior |
|---------|---------------------|
| Pub Firebase web | `VITE_FIREBASE_*` |
| Pub API | `VITE_APKZIO_API_URL` |
| Google token verification | `FIREBASE_SERVICE_ACCOUNT_JSON` or `PATH` on **API host** |
| Admin CRM when enforced | Optional `VITE_APKZIO_ADMIN_API_KEY` (**browser-visible** — internal consoles only) |

**Important:** Supabase JWT sent from admin as `Authorization` is **not** the same as local-api’s signed Bearer for pub users. For production **operator** access to `/api/admin/*`, prefer **admin key** or a dedicated backend proxy that validates Supabase server-side.

---

## 3. Target information architecture (enterprise-complete)

### 3.1 Global directory (`/clients`)

**Columns (baseline)**

- Lifecycle: **Lead / Active / Churned** (extendable to trial, suspended, non-paying)
- Customer, email, **verified**, **auth** (Google / password / SSO later)
- **Plan** + commercial tier / seat count (future)
- **Apps**, **builds**, **active subs**, **LTV** (or ARR placeholder)
- **Created**, **last active** (needs instrumentation — see §5)

**Filters & actions**

- Full-text search, plan, status, date range, revenue band, “has open invoice”, “Google linked”
- Saved views (e.g. “Enterprise renewal under 90 days”)
- Bulk export CSV (PII-scoped by role)
- **Never** surface password hashes, reset tokens, or raw Firebase UIDs in UI (internal IDs only).

### 3.2 Client 360 (`/clients/:id`)

| Tab | Contents |
|-----|----------|
| **Overview** | Identity, verification, auth methods, tags, CSM owner, health score, SLA, residency |
| **Organizations** | Parent account / child workspaces (B2B hierarchy) |
| **Billing** | Subscriptions, contracts, invoices, payments, taxes, credits, payment methods (Stripe IDs tokenized) |
| **Usage & entitlement** | API volume, builds/minute, seats, feature flags, overage |
| **Product** | Owned apps, builds, linked dispatcher projects, FCM send volume |
| **Engagement** | Email/support tickets, contact form, NPS/CSAT, meeting notes |
| **Risk & compliance** | Chargeback risk, abuse flags, GDPR export/delete workflow status |
| **Audit** | Impersonations, config changes, who viewed PII (immutable log) |

---

## 4. UI polish checklist (do not skip)

- **Empty states**: Distinguish “no customers yet” vs “API forbidden” vs “wrong data source”.
- **Loading**: Skeleton rows + stale-data indicator (last refreshed).
- **Errors**: 403 → actionable copy (admin key, enforcement, wrong host).
- **Accessibility**: Table headers, row actions keyboard reachable, status not color-only.
- **Mobile**: Horizontal scroll + sticky first column on directory.
- **Security banners**: When `VITE_APKZIO_ADMIN_API_KEY` is unset under enforcement — inline warning (already partially mirrored on Clients page).

---

## 5. Data & instrumentation gaps

| Gap | Mitigation |
|-----|------------|
| No `last_login_at` / `last_active_at` | **Partial:** `last_seen_at` on `StoredUser` + auth/`/me` touches (operator CRM). Extend with heartbeats / device telemetry later. |
| In-memory store | Migrate to Postgres (Supabase) with RLS separating operator vs tenant |
| No Stripe ledger | Map `stripe_customer_id`, sync webhooks → subscriptions/payments |
| No ticket system | Integrate Zendesk/Linear webhooks → engagement tab |

---

## 6. Phased roadmap

### Phase A — Foundation (done in repo)

- Admin `/api/admin/clients` + `/clients` UI + Google linking clarity + CORS/header support.
- **Follow-up (done):** `last_seen_at` instrumentation; CRM filters (`status`, `google_linked`); CSV export; loading skeleton; sticky status column; overview “Last activity”.

### Phase B — Persistence & authZ

- Supabase tables: `customers`, `customer_entitlements`, `billing_events`, `audit_log`.
- Server-side **proxy** for admin CRM (no admin secret in browser).
- RBAC roles: `viewer`, `billing`, `support`, `admin`.

### Phase C — Revenue & usage

- Stripe reconciliation, tax/VAT fields, dunning states.
- Usage metering (API calls, builds, MAU) with quota breach alerts.

### Phase D — Enterprise automation

- Health scores, churn triggers, Salesforce / HubSpot sync.
- Impersonation with strict audit + break-glass workflow.

---

## 7. Acceptance criteria (definition of done)

- Operator can answer in **one screen**: *Who is this customer, what do they pay, what did they deploy, are they healthy?*
- No conflicting copies of auth docs (pub vs admin vs API) for Google merge behavior.
- All PII access paths logged in Phase B+.

---

## 8. Related paths

- Public auth API: `backends/local-api/src/server.ts` (`/api/auth/*`, `/api/admin/clients*`).
- Admin UI: `apkzio-admin/src/pages/Clients.tsx`, `ClientDetail.tsx`.
- Pub auth UX: `apkzio-pub/src/app/pages/auth/login.tsx`, `register.tsx`.
