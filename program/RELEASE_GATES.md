# Release Gates

As of 2026-05-05

## Gate definitions

| Gate | Name | Pass Criteria | Current |
|---|---|---|---|
| G0 | Scope Integrity | Component inventory matches declared release architecture; ownership assigned for each deployable unit. | RED |
| G1 | Static Quality | Lint + typecheck + build pass for each release component; tests exist for critical services. | YELLOW |
| G2 | Contract Integrity | API/auth/env contracts frozen and versioned; no unresolved breaking changes across apps/services. | YELLOW |
| G3 | Integration Flow | End-to-end smoke passes for critical user and dispatch flows on integrated environment. | RED |
| G4 | Operability | Health checks, logging, queue/backpressure visibility, on-call runbook and rollback steps validated. | YELLOW |
| G5 | Release Control | Go/no-go checklist complete, risk acceptance signed, release notes + rollback owner confirmed. | RED |

## Baseline command evidence (2026-05-05)

### Passed

- `apkzio-admin`
  - `npm run lint` -> pass
  - `npm run build` -> pass
- `ApkZio-Public-Frontend/ApkZio`
  - `npm run build` -> pass (chunk-size warning only)
- `backends/local-api`
  - `npm run build` -> pass
- `backends/firebase-service`
  - `npm run build` -> pass

### Updated backend hardening baseline (2026-05-05, later)

- `backends/local-api`
  - `npm run lint` -> pass
  - `npm run build` -> pass
  - `npm run test` -> pass (auth + billing + admin-access policy tests)
- `backends/firebase-service`
  - `npm run lint` -> pass (ESLint v9 flat config wired)
  - `npm run build` -> pass
  - `npm run test` -> pass
- `go vet` / `go test`
  - No `go.mod` found in active checkout (scope mismatch still open under G0).

## Exit criteria to move all gates GREEN

1. G0: close ORCH-001 and ORCH-002 with confirmed architecture map.
2. G1: expand from baseline tests to full critical flow coverage (including deposit/withdraw once endpoints exist).
3. G2: complete ORCH-004 and ORCH-102.
4. G3: implement and run ORCH-005 smoke workflow.
5. G4: complete ORCH-103 and ORCH-104 evidence.
6. G5: run ORCH-006 go/no-go checklist and publish release decision.
