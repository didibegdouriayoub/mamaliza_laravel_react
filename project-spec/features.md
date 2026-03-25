# Features — Fromagerie Management System

> Status key: ✅ Complete | 🟡 Partial | 🔴 Missing

---

## F1 · Authentication & Sessions

| # | Feature | Status | Notes |
|---|---|---|---|
| F1.1 | Email + password login | 🟡 | UI exists; password not validated |
| F1.2 | JWT token issued on login | 🔴 | No token; no Authorization header |
| F1.3 | Session persistence across page refresh | 🔴 | State is in-memory React only |
| F1.4 | Logout | ✅ | Clears auth state |
| F1.5 | Current user fetched from token on load | 🔴 | `GET /api/auth/me` not implemented |

---

## F2 · User Management

| # | Feature | Status | Notes |
|---|---|---|---|
| F2.1 | List all users | ✅ | UI + context |
| F2.2 | Edit user role (admin / supervisor / operator) | 🟡 | In-memory only; not persisted |
| F2.3 | Edit fine-grained permissions | 🟡 | In-memory only; not persisted |
| F2.4 | Create new user / invite by email | 🔴 | No form or endpoint |
| F2.5 | Delete / deactivate user | 🔴 | No UI or endpoint |
| F2.6 | Permission-gated access to this page | ✅ | `manage_users` check exists |

---

## F3 · Inventory Management

| # | Feature | Status | Notes |
|---|---|---|---|
| F3.1 | List inventory items with search & filters | ✅ | Name/supplier search, type filter, date filter |
| F3.2 | Date-in-time stock query | 🟡 | Client-side reconstruction; needs backend support |
| F3.3 | Create inventory item | ✅ | Form with supplier dropdown |
| F3.4 | Edit inventory item | ✅ | Change history recorded on save |
| F3.5 | Delete inventory item | ✅ | Confirmation dialog |
| F3.6 | Change history / audit trail | 🟡 | Computed client-side; `changedBy` is hardcoded |
| F3.7 | Low-stock alerts | 🟡 | Badge shown; no notifications triggered |
| F3.8 | Print inventory list | ✅ | `window.print()` |
| F3.9 | Supplier dropdown from live data | 🔴 | Uses `mockSuppliers` directly |
| F3.10 | Auto-deduct stock when batch starts | 🔴 | Never triggered by batch workflow |
| F3.11 | Permission guard on write actions | 🔴 | `manage_inventory` not checked |

---

## F4 · Supplier Management

| # | Feature | Status | Notes |
|---|---|---|---|
| F4.1 | List suppliers | 🔴 | Mock data only |
| F4.2 | Create supplier | 🔴 | No page or form |
| F4.3 | Edit supplier | 🔴 | No page or form |
| F4.4 | Delete supplier | 🔴 | No page or form |

---

## F5 · Recipe Management

| # | Feature | Status | Notes |
|---|---|---|---|
| F5.1 | List recipes as cards with cost preview | ✅ | |
| F5.2 | View recipe detail (ingredients, steps, cost) | ✅ | Dialog |
| F5.3 | Create recipe with ingredients from inventory | 🟡 | Ingredient dropdown uses `mockInventory` |
| F5.4 | Edit recipe with version increment | 🟡 | `changedBy` hardcoded |
| F5.5 | Delete recipe | ✅ | Confirmation dialog |
| F5.6 | Recipe change history / audit trail | 🟡 | Client-side only |
| F5.7 | Version badge | ✅ | Shown on cards |
| F5.8 | Permission guard on write actions | 🔴 | `manage_recipes` not checked |

---

## F6 · Batch Tracking

| # | Feature | Status | Notes |
|---|---|---|---|
| F6.1 | Kanban view by status | ✅ | draft / in_production / completed / failed |
| F6.2 | Table view | ✅ | |
| F6.3 | Create batch (single or bulk) | ✅ | N-batch creation supported |
| F6.4 | Batch detail with materials & notes | ✅ | Dialog |
| F6.5 | Edit batch (recipe, status, output qty) | ✅ | |
| F6.6 | Add note to batch | ✅ | Per-batch notes with author |
| F6.7 | Status transitions | ✅ | All → all transitions allowed |
| F6.8 | Delete batch | ✅ | Confirmation dialog |
| F6.9 | Printable batch production sheet | ✅ | Material table + steps + signature lines |
| F6.10 | Inventory deduction on batch start | 🔴 | No side-effect triggered |
| F6.11 | Quality score reflected on batch | 🔴 | `qualityScore` never updated by QC flow |
| F6.12 | Recipe list from live data | 🔴 | Uses `mockRecipes` directly |
| F6.13 | Permission guard on write actions | 🔴 | `manage_batches` not checked |

---

## F7 · Quality Control

| # | Feature | Status | Notes |
|---|---|---|---|
| F7.1 | List quality evaluations as cards | ✅ | |
| F7.2 | Create evaluation (taste, texture, smell, notes) | ✅ | Star rating UI |
| F7.3 | Approve / Reject batch | ✅ | Toggle buttons |
| F7.4 | Update/correct an evaluation | 🔴 | No edit form |
| F7.5 | Delete evaluation | ✅ | Delete in service |
| F7.6 | Write `qualityScore` back to batch on save | 🔴 | Side-effect missing |
| F7.7 | Batch list from live data (not mock) | 🔴 | Uses `mockBatches` directly |
| F7.8 | Permission guard | 🔴 | `manage_quality` not checked |

---

## F8 · Sales & Orders

| # | Feature | Status | Notes |
|---|---|---|---|
| F8.1 | List all orders with search | ✅ | Balance, status, paid columns shown |
| F8.2 | Order detail view | ✅ | Items, payments, returns in dialog |
| F8.3 | Create new order | 🔴 | No form or button exists |
| F8.4 | Record payment (amount, method) | ✅ | Auto-updates status to partial/paid |
| F8.5 | Record return (product, qty, refund) | ✅ | |
| F8.6 | Set order status to `shipped` | 🔴 | No UI trigger |
| F8.7 | Cancel order | 🔴 | No UI trigger |
| F8.8 | Permission guard | 🔴 | `manage_sales` not checked |

---

## F9 · Customer Management

| # | Feature | Status | Notes |
|---|---|---|---|
| F9.1 | List customers | 🔴 | No UI or service |
| F9.2 | Create customer | 🔴 | No UI or service |
| F9.3 | Edit customer | 🔴 | No UI or service |
| F9.4 | Delete customer | 🔴 | No UI or service |

---

## F10 · Production Log

| # | Feature | Status | Notes |
|---|---|---|---|
| F10.1 | List production logs | ✅ | UI exists |
| F10.2 | Create production log (pieces, leftovers, notes) | 🟡 | Local state only — lost on refresh |
| F10.3 | Delete production log | 🔴 | No delete button |
| F10.4 | Feed leftovers back to inventory | 🔴 | Not implemented |
| F10.5 | Persist logs via backend | 🔴 | No `productionLogService` |

---

## F11 · Production Estimation

| # | Feature | Status | Notes |
|---|---|---|---|
| F11.1 | Select recipes + batch counts | ✅ | |
| F11.2 | Aggregate ingredient requirements | ✅ | |
| F11.3 | Show stock availability per ingredient | ✅ | OK / shortfall badge |
| F11.4 | Estimate packaging needs | 🟡 | Heuristic only (1 label / yield unit) |
| F11.5 | Cost summary (ingredient + packaging + total) | ✅ | |
| F11.6 | Print estimation report | ✅ | |
| F11.7 | Convert estimation to actual batches | 🔴 | No "Create Batches" action |
| F11.8 | Save / name estimations | 🔴 | Pure in-memory calculator |

---

## F12 · Analytics & Dashboard

| # | Feature | Status | Notes |
|---|---|---|---|
| F12.1 | KPI cards (revenue, active batches, low stock, inventory count) | 🟡 | Mock data, not live |
| F12.2 | Monthly revenue line chart | 🟡 | Hardcoded `salesChartData` |
| F12.3 | Monthly batch performance bar chart | 🟡 | Hardcoded `batchChartData` |
| F12.4 | Recipe usage pie chart | 🟡 | Computed from `mockBatches`/`mockRecipes` |
| F12.5 | Revenue trend (analytics page) | 🟡 | Same hardcoded data |
| F12.6 | Batch success rate KPI | 🟡 | From mock |
| F12.7 | Live data from backend analytics endpoints | 🔴 | No API calls |
| F12.8 | Permission guard on analytics page | 🔴 | `view_analytics` not checked |

---

## F13 · Notifications

| # | Feature | Status | Notes |
|---|---|---|---|
| F13.1 | `Notification` data model | ✅ | Defined in `types.ts` |
| F13.2 | Notification service | 🔴 | No service file |
| F13.3 | Bell icon / notification panel in nav | 🔴 | Not rendered anywhere |
| F13.4 | Mark as read | 🔴 | No UI |
| F13.5 | Auto-create notification on low stock | 🔴 | No trigger |
| F13.6 | Auto-create notification on batch failure | 🔴 | No trigger |
