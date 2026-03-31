# TASKS.md — Current Sprint / Backlog

> Priority: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
> Status: ☐ Todo | 🔄 In Progress | ✅ Done

---

## Phase 12 — Audit, Bug Fixes & Polish

### Sprint 1: End-to-End Verification

| # | Task | Priority | Status |
|---|---|---|---|
| T12.1 | Verify Docker setup: confirm frontend port mapping (`5173:8080`) is correct and app loads | 🔴 | ✅ |
| T12.2 | Login flow: verify login, token storage, session restore on refresh, logout | 🔴 | ✅ |
| T12.3 | Inventory: test full CRUD + history recording + auto status (ok/low/out) | 🔴 | ✅ |
| T12.4 | Recipes: test full CRUD + ingredient sync + history recording | 🔴 | ☐ |
| T12.5 | Batches: test create (inventory deduction) + delete (inventory restoration) | 🔴 | ☐ |
| T12.6 | Quality: test create evaluation → verify batch quality_score is updated | 🔴 | ☐ |
| T12.7 | Sales: test create order + record payment → verify status auto-update | 🔴 | ☐ |
| T12.8 | RBAC: test that operator cannot access admin-only actions | 🟠 | ☐ |
| T12.9 | Notifications: verify low-stock and batch-failure notifications are created | 🟠 | ☐ |
| T12.10 | Production logs: test create log + leftover return to inventory | 🟠 | ☐ |
| T12.11 | Estimation: test recipe selection → ingredient requirements → create batches | 🟡 | ☐ |
| T12.12 | Analytics: verify dashboard KPIs and charts load from live API data | 🟡 | ☐ |

### Sprint 2: Known Potential Bugs

| # | Task | Priority | Status |
|---|---|---|---|
| T12.13 | Investigate and fix any 404/500 errors found during Sprint 1 | 🔴 | ☐ |
| T12.14 | Verify batch notes (`POST /api/batches/{id}/notes`) works end-to-end in frontend | 🟠 | ☐ |
| T12.15 | Verify order returns accounting (`amount_returned`) is correct | 🟠 | ☐ |
| T12.16 | Check that `unit_price` is always numeric — no NaN in recipe ingredients or order items | 🟠 | ☐ |
| T12.17 | Check Estimation page packaging ratio logic for edge cases | 🟡 | ☐ |

### Sprint 3: UX Improvements

| # | Task | Priority | Status |
|---|---|---|---|
| T12.18 | Add loading states / skeletons to pages that show empty on first load | 🟠 | ☐ |
| T12.19 | Surface API validation errors in forms (show error message under field) | 🟠 | ☐ |
| T12.20 | Add pagination or infinite scroll to Inventory list | 🟡 | ☐ |
| T12.21 | Add pagination to Orders list | 🟡 | ☐ |
| T12.22 | Add search to Batches page | 🟡 | ☐ |

### Sprint 4: Nice-to-Have Features

| # | Task | Priority | Status |
|---|---|---|---|
| T12.23 | Wire up `@tanstack/react-query` for all data fetching (caching, refetch, etc.) | 🟡 | ☐ |
| T12.24 | Export inventory list to CSV | 🟢 | ☐ |
| T12.25 | Export orders to CSV/PDF | 🟢 | ☐ |
| T12.26 | Save/name estimations to backend | 🟢 | ☐ |
| T12.27 | Mobile responsiveness audit and fixes | 🟢 | ☐ |

---

## Rules for this Project
1. Take tasks ONE at a time.
2. After completing a task, make a descriptive git commit immediately.
3. Test the feature before marking ✅.
4. Update this file as tasks are completed.
