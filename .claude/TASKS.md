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
| T12.3.1 | **Bug:** `entrypoint.sh` never runs `composer install` → `vendor/autoload.php` missing → backend crash-loop on every start | 🔴 | ✅ |
| T12.3.2 | **Bug:** `APP_KEY` missing from `docker-compose.yml` → Laravel throws "No application encryption key" once vendor is fixed | 🔴 | ✅ |
| T12.3.3 | **Bug:** entrypoint writes `.env` with only `APP_KEY` → volume-mounts it to host → Laravel finds no `DB_CONNECTION` → falls back to SQLite instead of MySQL | 🔴 | ✅ |
| T12.3.4 | **Bug:** Inventory routes use `{inventory_item}` wildcard but controller methods declare `$inventory` — Laravel implicit binding resolves `{inventory_item}` → `$inventoryItem` (camelCase), not `$inventory` → injects empty model → `item_id` is null on history write, delete silently does nothing | 🔴 | ✅ |
| T12.3.5 | **Bug:** `POST /batches/{batch}/notes` route and `BatchController::storeNote` method are both missing → `batchService.addNote` always 404s | 🔴 | ✅ |
| T12.4 | Recipes: test full CRUD + ingredient sync + history recording | 🔴 | ✅ |
| T12.5 | Batches: test create (inventory deduction) + delete (inventory restoration) | 🔴 | ✅ |
| T12.6 | Quality: test create evaluation → verify batch quality_score is updated | 🔴 | ✅ |
| T12.7 | Sales: test create order + record payment → verify status auto-update | 🔴 | ✅ |
| T12.7.1 | **Bug:** `POST /orders/{order}/payments`, `POST /orders/{order}/returns`, `PATCH /orders/{order}/status` routes missing → orderService.addPayment / addReturn / patchStatus always 404 | 🔴 | ✅ |
| T12.7.2 | **Bug:** `order_returns.order_item_id` DB column NOT NULL but frontend never sends it → INSERT fails with constraint violation | 🔴 | ✅ |
| T12.7.3 | **Bug:** Payment method enum is lowercase (`cash`, `bank_transfer`) but frontend sends `"Cash"`, `"Bank Transfer"` → MySQL rejects the insert | 🔴 | ✅ |
| T12.7.4 | **Bug:** `orderService.addPayment` sends `{method, date}` but backend expects `{method, paid_at}` (wrong field name); `addReturn` sends camelCase keys, backend gets garbage | 🔴 | ✅ |
| T12.7.5 | **Bug:** `orders.customer_id` is NOT NULL in migration but controller accepts nullable — creating an order without customer 422s from DB | 🟠 | ✅ |
| T12.7.6 | **Bug:** `OrderController.store` validates status `in:pending,paid,cancelled,completed` but migration enum is `pending,partial,paid,shipped,cancelled` — 'completed' and 'shipped' mismatch | 🟠 | ✅ |
| T12.7.7 | **Bug:** `order_returns` table has no `product_name` column but frontend displays `r.productName` in return list — always undefined | 🟠 | ✅ |
| T12.7.8 | **Bug:** `Payment` and `ReturnItem` types use `date` field but API returns `paidAt` / `returnedAt` — date always shown as undefined in UI | 🟠 | ✅ |
| T12.8 | RBAC: test that operator cannot access admin-only actions | 🟠 | ✅ |
| T12.9 | Notifications: verify low-stock and batch-failure notifications are created | 🟠 | ✅ |
| T12.9.1 | **Bug:** `notificationService.markAsRead` calls `PUT /notifications/{id}` but only `PATCH /notifications/{id}/read` exists → 404; and `NotificationController::markAsRead` method is missing → 500 if the correct route is hit | 🔴 | ✅ |
| T12.9.2 | **Bug:** `BatchObserver` has no `failed` status handler → batch-failure notifications never created | 🟠 | ✅ |
| T12.9.3 | **Bug:** `InventoryItemObserver` sends low-stock with `type:'info'` instead of `type:'warning'` | 🟡 | ✅ |
| T12.10 | Production logs: test create log + leftover return to inventory | 🟠 | ✅ |
| T12.10.1 | **Bug:** Production.tsx displays `l.materialName`/`l.material_name` but DB stores `item`; displays `l.quantity` but DB stores `amount` → leftover list always blank | 🔴 | ✅ |
| T12.10.2 | **Bug:** `handleSave` in Production.tsx has no try/catch → silent failure on error | 🟠 | ✅ |
| T12.11 | Estimation: test recipe selection → ingredient requirements → create batches | 🟡 | ✅ |
| T12.12 | Analytics: verify dashboard KPIs and charts load from live API data | 🟡 | ✅ |

### Sprint 2: Known Potential Bugs

| # | Task | Priority | Status |
|---|---|---|---|
| T12.13 | Investigate and fix any 404/500 errors found during Sprint 1 | 🔴 | ✅ |
| T12.14 | Verify batch notes (`POST /api/batches/{id}/notes`) works end-to-end in frontend | 🟠 | ✅ |
| T12.14.1 | **Bug:** note silently dropped on batch create — `batchService.create` response ID not used to call `addNote` | 🔴 | ✅ |
| T12.15 | Verify order returns accounting (`amount_returned`) is correct | 🟠 | ✅ |
| T12.16 | Check that `unit_price` is always numeric — no NaN in recipe ingredients or order items | 🟠 | ✅ |
| T12.17 | Check Estimation page packaging ratio logic for edge cases | 🟡 | ✅ |

### Sprint 3: UX Improvements

| # | Task | Priority | Status |
|---|---|---|---|
| T12.18 | Add loading states / skeletons to pages that show empty on first load | 🟠 | ✅ |
| T12.19 | Surface API validation errors in forms (show error message under field) | 🟠 | ✅ |
| T12.20 | Add pagination or infinite scroll to Inventory list | 🟡 | ✅ |
| T12.21 | Add pagination to Orders list | 🟡 | ✅ |
| T12.22 | Add search to Batches page | 🟡 | ✅ |

### Sprint 4: Nice-to-Have Features

| # | Task | Priority | Status |
|---|---|---|---|
| T12.23 | Wire up `@tanstack/react-query` for all data fetching (caching, refetch, etc.) | 🟡 | ☐ |
| T12.24 | Export inventory list to CSV | 🟢 | ✅ |
| T12.25 | Export orders to CSV/PDF | 🟢 | ✅ |
| T12.26 | Save/name estimations to backend | 🟢 | ☐ |
| T12.27 | Mobile responsiveness audit and fixes | 🟢 | ✅ |

---

## Rules for this Project
1. Take tasks ONE at a time.
2. After completing a task, make a descriptive git commit immediately.
3. Test the feature before marking ✅.
4. Update this file as tasks are completed.
