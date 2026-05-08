# Program Orchestration

Last updated: 2026-05-05
Program role: Monorepo orchestrator (planning, sequencing, integration verification)

## 1) Working topology (observed in this checkout)

- Backend services:
  - `backends/local-api` (Node/TS API for local integration)
  - `backends/firebase-service` (Node/TS dispatcher worker)
  - `backends/*.sql` (database schema/migrations for Supabase/Postgres)
- React SPAs:
  - `apkzio-admin` (Vite + React admin console)
  - `ApkZio-Public-Frontend/ApkZio` (Vite + React public/product frontend)
- Expected but not found in active tree:
  - Go backend service (`go.mod` not present)
  - Cloudflare worker config (`wrangler.toml/json` not present)
  - Third React SPA (only two active SPA roots found)

## 2) Ticket backlog (P0/P1/P2)

Legend: `Status = TODO | IN_PROGRESS | BLOCKED | DONE`

| ID | Priority | Ticket | Depends On | Owner | Status | Gate Impact |
|---|---|---|---|---|---|---|
| ORCH-001 | P0 | Topology reconciliation: confirm where Go backend, 3rd SPA, and Cloudflare worker live (or update release scope). | - | Platform Lead | BLOCKED | G0 |
| ORCH-002 | P0 | Define release train scope (components, versions, deploy targets, rollback owner map). | ORCH-001 | Program | TODO | G0 |
| ORCH-003 | P0 | Make `firebase-service` lint gate pass (ESLint v9 flat config or pin strategy). | - | Backend | DONE | G1 |
| ORCH-004 | P0 | Minimum integration contract freeze (auth token format, API base URLs, campaign flow, key endpoints). | ORCH-002 | Backend + SPA leads | TODO | G2 |
| ORCH-005 | P0 | Cross-app smoke suite for critical path: sign-in -> app list -> campaign create -> dispatch visibility. | ORCH-004 | QA/Integration | TODO | G3 |
| ORCH-006 | P0 | Release decision checklist + go/no-go meeting with blockers resolved. | ORCH-003, ORCH-005 | Program | TODO | G5 |
| ORCH-101 | P1 | Add and enforce test presence policy for `firebase-service` (currently no tests discovered). | ORCH-003 | Backend | DONE | G1 |
| ORCH-102 | P1 | Standardize env templates and secret owners across admin/public/backend modules. | ORCH-002 | Platform | TODO | G2 |
| ORCH-103 | P1 | Build artifact governance (dist checksum, artifact retention, release notes template). | ORCH-002 | DevOps | TODO | G4 |
| ORCH-104 | P1 | Runtime observability baseline: health endpoints, queue depth, dispatch failures, alert thresholds. | ORCH-004 | SRE | TODO | G4 |
| ORCH-201 | P2 | Performance budgets and bundle split plan for public SPA (large chunk warning). | ORCH-005 | Frontend | TODO | G4 |
| ORCH-202 | P2 | DX cleanup: remove stale worktree artifacts from release path and tighten ignore policy. | ORCH-002 | Tooling | TODO | G0 |

## 3) Dependency sequencing

1. ORCH-001 -> ORCH-002
2. ORCH-002 + ORCH-003 in parallel
3. ORCH-004 after ORCH-002
4. ORCH-005 after ORCH-004
5. ORCH-006 after ORCH-003 + ORCH-005
6. P1/P2 flow after P0 critical path is green

## 4) Integration verification policy

- Every P0 ticket must produce:
  - command evidence (build/lint/test/smoke),
  - affected module list,
  - release gate delta (what moved Red -> Yellow/Green),
  - explicit blocker handoff if unresolved.

- No release candidate cut when any P0 is `BLOCKED` or `TODO`.
