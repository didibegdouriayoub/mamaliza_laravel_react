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

## Phase 13 — Inventory Fixes, Recipe UX & Batch Redesign

### Sprint 1: Inventory Polish

| # | Task | Priority | Status |
|---|---|---|---|
| T13.1 | Inventory — pre-select supplier in the **update** modal (currently always blank) | 🔴 | ✅ |
| T13.2 | Inventory — pre-select supplier when **name is chosen** from the autocomplete on create | 🔴 | ✅ |
| T13.3 | Inventory — auto-generate `code` field (e.g. `INV-XXXXXX`) on create/update if left blank | 🟠 | ✅ |
| T13.4 | Inventory — when `quantity` reaches exactly **0**, force status to `out` regardless of `min_stock` | 🔴 | ✅ |
| T13.5 | Inventory — print view: show only the **page title** and the inventory **table** (hide all controls, filters, dialogs) | 🟡 | ✅ |

### Sprint 2: Recipe Page Fixes

| # | Task | Priority | Status |
|---|---|---|---|
| T13.6 | Recipe — display live **packaging cost** estimate (from packaging inventory items × quantities) inside the create and update forms | 🟠 | ✅ |
| T13.7 | **Bug:** Recipe — `targetWeight` field resets / updates itself when another field is edited in the form — investigate controlled-input state binding and fix | 🔴 | ✅ |

### Sprint 3: Batch Create Redesign + Print Report

| # | Task | Priority | Status |
|---|---|---|---|
| T13.8 | Batch create — **step 1**: select recipe + number of batches | 🔴 | ✅ |
| T13.9 | Batch create — **step 2**: show one expandable card per batch, each pre-filled with recipe ingredients; allow editing individual ingredient qty and adding extra ingredients per batch | 🔴 | ✅ |
| T13.10 | Batch create — **step 3**: save all batches as a group in a single submit (one API call per batch, but triggered together) | 🔴 | ✅ |
| T13.11 | Batch print report — generate a **print-friendly report** per batch group showing: recipe name, batch list with lot numbers and quantities, ingredient breakdown per batch | 🟠 | ✅ |

### Sprint 4: Batch Groups, Production Loss & Inventory Types

| # | Task | Priority | Status |
|---|---|---|---|
| T13.12 | Batch table grouped by recipe/creation group (batch_groups) | 🔴 | ✅ |
| T13.13 | Remove draft + in_production statuses; new batches default to completed | 🔴 | ✅ |
| T13.14 | Move completed → failed auto-creates leftover inventory item (LO-DD-MM-YYYY-recipe) | 🔴 | ✅ |
| T13.15 | Add `leftover` and `product` inventory types | 🟠 | ✅ |
| T13.16 | User fills pieces_produced per batch group → creates product inventory entry | 🔴 | ✅ |
| T13.17 | User fills leftover_qty per batch group → creates leftover inventory entry | 🔴 | ✅ |
| T13.18 | Dashboard: Production Loss chart by recipe for selected day | 🔴 | ✅ |

### Sprint 5: UX Fixes

| # | Task | Priority | Status |
|---|---|---|---|
| T13.19 | Inventory history — format `changedAt` as `DD-MM-YYYY HH:mm` | 🟠 | ✅ |
| T13.20 | Recipe history + detail modal `updatedAt` — format as `DD-MM-YYYY HH:mm` | 🟠 | ✅ |
| T13.21 | Batches — format group `createdAt` and batch `startedAt` as `DD-MM-YYYY HH:mm` | 🟠 | ✅ |
| T13.22 | Quality — format `evaluatedAt` and batch select `startedAt` as `DD-MM-YYYY HH:mm` | 🟠 | ✅ |
| T13.23 | Extract shared `formatDate` util to `src/lib/formatDate.ts`; remove inline duplicates | 🟠 | ✅ |

### Sprint 6: Batch Detail & Recipe Update

| # | Task | Priority | Status |
|---|---|---|---|
| T13.24 | Batches — View button per batch row opens detail dialog (ingredients, QC score, notes) | 🟠 | ✅ |
| T13.25 | Batches — "Update Recipe" button in batch detail only visible when QC `overallScore > 4`; opens inline recipe edit form | 🔴 | ✅ |
| T13.26 | **Bug:** `batch_notes.author_id` is NOT NULL but `storeNote` never sets it → INSERT fails with 1364 | 🔴 | ✅ |
| T13.27 | Batches — group "View" button opens detail dialog with all batches, lot numbers, QC scores, and loss summary | 🟠 | ✅ |
| T13.28 | Batches — persist `lot` to DB (migration + model + controller); send from frontend on create; display in table | 🔴 | ✅ |
| T13.29 | Quality — show lot number in batch select dropdown alongside recipe name and date | 🟠 | ✅ |
| T13.30 | Batches — auto-generate unique lot on backend: `{3-letters}-{DDMMYYYY}-{NNN}` incremented per recipe+date; remove frontend lot generation | 🔴 | ✅ |
| T13.31 | Batches — group view dialog shows full details per batch: ingredients table, notes, QC evaluation (taste/texture/smell/score) | 🟠 | ✅ |
| T13.32 | Batches — add `startedAt` date field per batch in create form, pre-filled with today; send to API | 🟠 | ✅ |

### Sprint 7: Estimation Redesign — Procurement Planning

> Decisions locked:
> - Lead time stored per inventory item (`lead_time_days`)
> - Procurement plan covers only the deficit (missing stock), not full reorder qty
> - No holding/opportunity cost — just purchase cost of missing materials
> - Deficit is aggregated across all recipes in the estimation
> - Estimation is read-only (no "Create Batches" button)

| # | Task | Priority | Status |
|---|---|---|---|
| T13.41 | Inventory — add `lead_time_days` (integer, nullable) to inventory items: migration + model + controller + form field | 🔴 | ✅ |
| T13.42 | Estimation — remove "Create Batches" button; page becomes read-only planning tool | 🟠 | ✅ |
| T13.43 | Estimation — fix stock check to match ingredients by `materialId` (not by name) | 🔴 | ✅ |
| T13.44 | Estimation — replace packaging ratio system with `recipe.packages` quantities × batchCount per recipe | 🔴 | ✅ |
| T13.45 | Estimation — add Procurement Plan table: one row per deficit material showing qty to order, supplier, lead time (days), order cost | 🔴 | ✅ |
| T13.46 | Estimation — show critical path banner: material with longest lead time → "Earliest production start: X days" | 🟠 | ✅ |
| T13.47 | Estimation — split total investment into: already in stock cost + materials to order cost + packaging to order cost | 🟠 | ✅ |

---

### Sprint 8: Bug Fixes

| # | Task | Priority | Status |
|---|---|---|---|
| T13.48 | **Bug:** `DELETE /api/recipes/{id}` 500 — FK constraint `batches_recipe_id_foreign ON DELETE RESTRICT` blocks hard delete when batches exist → add `SoftDeletes` to `Recipe` model + migration for `deleted_at` | 🔴 | ✅ |
| T13.49 | **Bug:** Page not loading after soft-delete change — `GET /api/recipes` returns 500 in certain contexts; investigate root cause and fix | 🔴 | 🔄 |
| T13.50 | UX: Widen quantity inputs in recipe create/edit and batch create forms by ~50px (too narrow for numbers) | 🟠 | ✅ |
| T13.51 | **Bug:** Deleting a batch group removes the individual batches but leaves the `batch_groups` record — `BatchGroupController` has no `destroy` method and no DELETE route registered | 🔴 | ✅ |

---

## Rules for this Project
1. Take tasks ONE at a time.
2. After completing a task, make a descriptive git commit immediately.
3. Test the feature before marking ✅.
4. Update this file as tasks are completed.
