# Tasks — Fromagerie Management System

## Scrum Master & Agent Workflow Rules
1. **Focus:** The Agent must adopt the role of Scrum Master and act iteratively, taking exactly ONE task or feature at a time.
2. **Phase Branching:** Before starting a new Phase, verify we are on main, then create a feature branch (`git checkout -b feature/phase-N`).
3. **Continuous Commits:** After fully finishing and verifying each individual task or feature, the Agent MUST make a descriptive git commit (`git commit -am "feat: ..."`) immediately.
4. **Phase Merging:** Once all tasks in the current Phase are 100% completed and tested, the Agent MUST merge the feature branch back into the main branch before proceeding.

> Priority: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low  
> Status: ☐ Todo | 🔄 In Progress | ✅ Done

---

## Phase 0 — Backend Setup

| # | Task | Priority | Status |
|---|---|---|---|
| T0.1 | Choose backend framework (laravel) | 🔴 | ✅ |
| T0.2 | Initialize backend project with folder structure | 🔴 | ✅ |
| T0.3 | Set up MySQL database and connect ORM | 🔴 | ✅ |
| T0.4 | Run database migrations for all core tables | 🔴 | ✅ |
| T0.5 | Add `VITE_API_URL` env variable to frontend | 🔴 | ✅ |
| T0.6 | Configure CORS (allow frontend origin) | 🔴 | ✅ |
| T0.7 | Add global error handler middleware | 🟠 | ✅ |

---

## Phase 1 — Authentication

| # | Task | Priority | Status |
|---|---|---|---|
| T1.1 | **Backend:** `POST /api/auth/login` — verify password hash, return JWT | 🔴 | ✅ |
| T1.2 | **Backend:** `GET /api/auth/me` — decode JWT, return current user | 🔴 | ✅ |
| T1.3 | **Backend:** `POST /api/auth/logout` — invalidate refresh token (if used) | 🟡 | ✅ |
| T1.4 | **Frontend:** Create `authService.ts` with `login()`, `logout()`, `getMe()` | 🔴 | ✅ |
| T1.5 | **Frontend:** Store JWT in `localStorage` (or httpOnly cookie) | 🔴 | ✅ |
| T1.6 | **Frontend:** Attach `Authorization: Bearer <token>` to all fetch calls | 🔴 | ✅ |
| T1.7 | **Frontend:** On app mount, call `GET /api/auth/me` to restore session | 🔴 | ✅ |
| T1.8 | **Frontend:** Fix `AuthContext.login()` — stop ignoring the password | 🔴 | ✅ |
| T1.9 | **Frontend:** Add token expiry handling (redirect to login on 401) | 🟠 | ✅ |
| T1.10 | **Seed:** Create initial admin user with hashed password in DB | 🔴 | ✅ |

---

## Phase 2 — Service Layer Migration

> Replace all mock-based services with real HTTP calls.

| # | Task | Priority | Status |
|---|---|---|---|
| T2.1 | Create shared `apiClient.ts` utility (base URL + auth header + error handling) | 🔴 | ✅ |
| T2.2 | Migrate `inventoryService.ts` to real API | 🔴 | ✅ |
| T2.3 | Migrate `recipeService.ts` to real API | 🔴 | ✅ |
| T2.4 | Migrate `batchService.ts` to real API | 🔴 | ✅ |
| T2.5 | Migrate `qualityService.ts` to real API | 🔴 | ✅ |
| T2.6 | Migrate `orderService.ts` to real API | 🔴 | ✅ |
| T2.7 | Create `userService.ts` | 🔴 | ✅ |
| T2.8 | Create `supplierService.ts` | 🟠 | ✅ |
| T2.9 | Create `customerService.ts` | 🟠 | ✅ |
| T2.10 | Create `productionLogService.ts` | 🟠 | ✅ |
| T2.11 | Create `notificationService.ts` | 🟡 | ✅ |
| T2.12 | Create `analyticsService.ts` | 🟡 | ✅ |

---

## Phase 3 — Backend Endpoints: CRUD Resources

| # | Task | Priority | Status |
|---|---|---|---|
| T3.1 | Inventory: `GET /api/inventory` + `POST` + `PUT /:id` + `DELETE /:id` | 🔴 | ✅ |
| T3.2 | Inventory: Append `inventory_history` row server-side on update (derive `changedBy` from JWT) | 🔴 | ✅ |
| T3.3 | Recipes: `GET /api/recipes` + `POST` + `PUT /:id` + `DELETE /:id` | 🔴 | ✅ |
| T3.4 | Recipes: Append `recipe_history` row server-side on update | 🔴 | ✅ |
| T3.5 | Batches: `GET /api/batches` + `POST` + `PUT /:id` + `DELETE /:id` | 🔴 | ✅ |
| T3.6 | Batches: `POST /api/batches/:id/notes` | 🟠 | ✅ |
| T3.7 | Quality: `GET /api/quality` + `POST` + `DELETE /:id` | 🔴 | ✅ |
| T3.8 | Quality: `PUT /api/quality/:id` (edit evaluation) | 🟡 | ✅ |
| T3.9 | Orders: `GET /api/orders` + `POST` | 🔴 | ✅ |
| T3.10 | Orders: `POST /api/orders/:id/payments` | 🔴 | ✅ |
| T3.11 | Orders: `POST /api/orders/:id/returns` | 🔴 | ✅ |
| T3.12 | Orders: `PATCH /api/orders/:id/status` (shipped, cancelled) | 🟠 | ✅ |
| T3.13 | Users: `GET /api/users` + `POST` + `PATCH /:id/role` + `PATCH /:id/permissions` + `DELETE /:id` | 🔴 | ✅ |
| T3.14 | Suppliers: `GET /api/suppliers` + `POST` + `PUT /:id` + `DELETE /:id` | 🟠 | ✅ |
| T3.15 | Customers: `GET /api/customers` + `POST` + `PUT /:id` + `DELETE /:id` | 🟠 | ✅ |
| T3.16 | Production logs: `GET /api/production-logs` + `POST` + `DELETE /:id` | 🟠 | ✅ |

---

## Phase 4 — Backend Business Logic (Side Effects)

| # | Task | Priority | Status |
|---|---|---|---|
| T4.1 | On batch `draft → in_production`: deduct `inputMaterials` from inventory | 🔴 | ✅ |
| T4.2 | On inventory deduction: write `inventory_history` records | 🔴 | ✅ |
| T4.3 | On `QualityControl` create: `UPDATE batches SET quality_score = overallScore` | 🔴 | ✅ |
| T4.4 | On payment added: auto-update order status to `partial` or `paid` | 🔴 | ✅ |
| T4.5 | On inventory update: if `quantity ≤ minStock`, create low-stock notification | 🟠 | ✅ |
| T4.6 | On batch status → `failed`: create notification for supervisors | 🟡 | ✅ |
| T4.7 | Enforce `changedBy` from JWT on all history writes (never from request body) | 🔴 | ✅ |
| T4.8 | Seed database with initial data (users, suppliers, inventory, recipes) | 🟠 | ✅ |

---

## Phase 5 — Frontend: Fix Broken / Incomplete Features

| # | Task | Priority | Status |
|---|---|---|---|
| T5.1 | Replace `mockSuppliers` in Inventory with `supplierService.getAll()` | 🔴 | ✅ |
| T5.2 | Replace `mockInventory` in Recipes ingredient dropdown with `inventoryService.getAll()` | 🔴 | ✅ |
| T5.3 | Replace `mockRecipes` in Batches form with `recipeService.getAll()` | 🔴 | ✅ |
| T5.4 | Replace `mockBatches` in Quality form with `batchService.getAll()` (filter completed only) | 🔴 | ✅ |
| T5.5 | Fix `changedBy` in Inventory history — use `user.name` from `AuthContext` | 🔴 | ✅ |
| T5.6 | Fix `changedBy` in Recipes history — use `user.name` from `AuthContext` | 🔴 | ✅ |
| T5.7 | Dashboard: replace `mockOrders`/`mockBatches`/`mockInventory` with service calls | 🔴 | ✅ |
| T5.8 | Analytics: replace `salesChartData`/`batchChartData` with `analyticsService` calls | 🔴 | ✅ |
| T5.9 | Sales: add "Create Order" form | 🔴 | ✅ |
| T5.10 | Sales: add status buttons for `shipped` and `cancelled` transitions | 🟠 | ✅ |
| T5.11 | UserManagement: add "Create User" form | 🟠 | ✅ |
| T5.12 | UserManagement: add "Delete User" confirmation | 🟠 | ✅ |
| T5.13 | Production Log: connect to `productionLogService` (persist to backend) | 🟠 | ✅ |
| T5.14 | Production Log: add delete button | 🟡 | ✅ |
| T5.15 | Quality Control: add edit/update evaluation dialog | 🟡 | ✅ |

---

## Phase 6 — Permission Guards

| # | Task | Priority | Status |
|---|---|---|---|
| T6.1 | Inventory page: guard Add/Edit/Delete with `manage_inventory` | 🟠 | ✅ |
| T6.2 | Recipes page: guard Create/Edit/Delete with `manage_recipes` | 🟠 | ✅ |
| T6.3 | Batches page: guard Create/Edit/Delete with `manage_batches` | 🟠 | ✅ |
| T6.4 | Quality page: guard New Evaluation with `manage_quality` | 🟠 | ✅ |
| T6.5 | Sales page: guard Record Payment/Return with `manage_sales` | 🟠 | ✅ |
| T6.6 | Analytics page: redirect if missing `view_analytics` | 🟡 | ✅ |
| T6.7 | Backend: add role/permission middleware to all protected routes | 🔴 | ✅ |

---

## Phase 7 — Missing Modules (New Pages / Features)

| # | Task | Priority | Status |
|---|---|---|---|
| T7.0 | **Permissions page:** list, create, edit, delete permissions | 🟠 | ✅ |
| T7.1 | **Inventory page:** fix bug http://localhost:5173/inventory dont loaded perfectly api good | 🟠 | ✅ |
| T7.2 | **Recipe page:** fix bug view details dont work and create recipe and problem NaN in recipe details | 🟠 | ✅ |
| T7.3 | **Customers page:** list, create, edit, delete customers | 🟠 | ✅ |
| T7.4 | **Suppliers page:** list, create, edit, delete suppliers | 🟠 | ✅ |
| T7.5 | **Notifications panel:** bell icon in nav, list, mark-as-read | 🟡 | ✅ |
| T7.6 | **Estimation → Batches:** "Create Batches from Estimation" button | 🟡 | ✅ |
| T7.7 | **Estimation:** configurable packaging ratios (not hardcoded) | 🟢 | ✅ |
| T7.8 | **Production Log leftovers → Inventory:** return leftover quantities to stock | 🟡 | ✅ |

---
## Phase 8 — Fix bugs
| #  | Task                                                                             | Priority | Status |
| -- | -------------------------------------------------------------------------------- | -------- | ------ |
| T8.1 | Ensure seeder is idempotent (safe to run multiple times)                         | 🔴       | ☐      |
| T8.2 | Validate unique email constraint is respected during seeding                     | 🔴       | ☐      |
| T8.3 | Add and register `GET /api/permissions` endpoint to return permissions list | 🔴       | ☐      |
| T8.4 | Fix bug http://localhost:5173/inventory dont loaded perfectly api good | 🔴       | ☐      |
| T8.5 | Fix bug view details dont work and create recipe and problem NaN in recipe details | 🔴       | ☐      |
| T8.6 | Ensure `unitPrice` is always a number (parse or validate API data before calling `.toFixed`) | 🔴       | ☐      |
