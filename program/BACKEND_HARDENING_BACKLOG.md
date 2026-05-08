# Backend Hardening Backlog (Owner: Backend)

Last updated: 2026-05-05

## P0 (release blocking)

| ID | Area | Task | Status | Evidence Gate |
|---|---|---|---|---|
| BE-HARD-001 | Auth | Enforce admin permission policy on admin API routes with explicit runtime flag and admin key path. | DONE | `local-api` lint/build/test |
| BE-HARD-002 | CI | Add backend CI gates for lint/build/test and go vet/test across detected modules. | DONE | GitHub workflow present |
| BE-HARD-003 | PR Hygiene | Enforce PR template sections for commands and rollback notes. | DONE | PR template present |
| BE-HARD-004 | Critical Tests | Add tests for auth primitives and wallet-like checkout/payment flows. | DONE | `local-api` tests passing |
| BE-HARD-005 | Dispatcher Lint | Fix ESLint v9 config gap in firebase-service. | DONE | `firebase-service` lint passing |

## P1 (next hardening wave)

| ID | Area | Task | Status |
|---|---|---|---|
| BE-HARD-101 | Wallet | Add explicit `deposit` and `withdrawal` endpoints with ledger-style idempotency keys and balance reconciliation tests. | TODO |
| BE-HARD-102 | Admin RBAC | Introduce role model (`admin`, `owner`, `viewer`) and route-level authorization tests. | TODO |
| BE-HARD-103 | Error Contracts | Standardize error envelope with stable error codes + correlation id, then add contract tests. | TODO |
| BE-HARD-104 | Deploy Safety | Add canary + rollback runbook automation hook in deploy pipeline. | TODO |

## Non-negotiable PR checklist (backend)

1. Include exact check commands run and outcomes.
2. Include rollback trigger + steps + owner.
3. Mention which critical flow(s) were touched: auth, wallet, admin permissions, error handling.
