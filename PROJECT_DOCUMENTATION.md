# Mamaliya Fromagerie — Complete Project Documentation

> **Stack:** Laravel 13 REST API + React 18 SPA + MySQL 8.0  
> **Domain:** Cheese factory (fromagerie) production & sales management  
> **Deployment:** Docker Compose (3 containers: backend, frontend, db)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Database Tables & Utility](#2-database-tables--utility)
3. [Model Relationships](#3-model-relationships)
4. [API Routes](#4-api-routes)
5. [Feature Modules](#5-feature-modules)
6. [Frontend Pages & Structure](#6-frontend-pages--structure)
7. [Access Control System](#7-access-control-system)
8. [Key Architectural Patterns](#8-key-architectural-patterns)

---

## 1. Project Overview

**Mamaliya** is a complete lifecycle management system for cheese production, covering:

- Raw material procurement & stock tracking
- Recipe formulation & versioning
- Production batch execution & traceability
- Quality control evaluation
- Packaging management
- Customer orders, payments & returns
- Analytics & reporting

---

## 2. Database Tables & Utility

### Users & Access Control

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| name | varchar | Full name |
| email | varchar (unique) | Login identifier |
| password | varchar | Bcrypt hashed |
| role | enum | `admin` / `supervisor` / `operator` |
| permissions | JSON | Array of permission strings (e.g. `["inventory.read","batches.write"]`) |
| avatar | varchar (nullable) | Profile image path |

**Utility:** Authentication and role-based access control. The `permissions` JSON column stores granular per-user overrides on top of the role-based defaults.

---

#### `permissions`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| name | varchar (unique) | Permission key (e.g. `batches.write`) |
| description | text (nullable) | Human-readable explanation |

**Utility:** Registry/catalog of all valid permission strings used throughout the system. Not enforced via FK — referenced by name in `users.permissions`.

---

### Supplier & Inventory

#### `suppliers`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| name | varchar | Supplier company name |
| contact | varchar (nullable) | Contact person |
| email | varchar (nullable) | Contact email |

**Utility:** Tracks raw material suppliers. Referenced by inventory items.

---

#### `inventory_items`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| name | varchar | Material name |
| type | enum | `raw` / `packaging` / `leftover` / `product` |
| quantity | decimal | Current stock quantity |
| unit | varchar | Measurement unit (kg, L, pcs…) |
| price | decimal | Unit price |
| supplier_id | FK → suppliers (nullable) | Source supplier |
| min_stock | decimal | Low-stock threshold |
| lot | varchar (nullable) | Lot/batch code for traceability |
| code | varchar (nullable) | Internal SKU code |
| status | enum (auto-calculated) | `ok` / `low` / `out` |
| lead_time_days | integer (nullable) | Days to reorder from supplier |

**Utility:** Core stock ledger. Status is auto-calculated on every save:
- `out` → qty ≤ 0
- `low` → 0 < qty ≤ min_stock
- `ok` → qty > min_stock

Quantity is automatically deducted when batches are created and restored when batches are deleted.

---

#### `inventory_history`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| item_id | FK → inventory_items | The changed item |
| field | varchar | Column that changed (e.g. `quantity`) |
| old_value | text | Previous value |
| new_value | text | New value |
| changed_by | FK → users | Who made the change |
| changed_at | timestamp | When the change occurred |

**Utility:** Immutable audit trail for every inventory change. Records are only inserted, never updated.

---

### Recipe Management

#### `recipes`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| name | varchar (indexed) | Recipe name |
| description | text (nullable) | Summary description |
| target_weight | decimal (nullable) | Expected batch output weight |
| piece_weight | varchar (nullable) | Weight per piece |
| recipe_status | enum (nullable) | `semi_final` / `final` |
| steps | JSON | Ordered array of production steps |
| packages | JSON | Packaging information array |
| version | integer (default 1) | Auto-incremented on every update |
| deleted_at | timestamp (nullable) | Soft-delete timestamp |

**Utility:** Master recipe library. Supports versioning — every update increments `version`. Uses soft deletes for archiving (recipes are never hard-deleted by default).

---

#### `recipe_ingredients`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| recipe_id | FK → recipes (cascade) | Parent recipe |
| material_id | FK → inventory_items | Linked inventory item |
| material_name | varchar | Snapshot of material name at time of save |
| quantity | decimal | Required quantity |
| unit | varchar | Measurement unit |
| unit_price | decimal | Snapshot of price at time of save |

**Utility:** Ingredient list per recipe. `material_name` and `unit_price` are snapshotted so historical recipes remain accurate even if the inventory item changes later. No timestamps — history is tracked via `recipe_history`.

---

#### `recipe_history`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| recipe_id | FK → recipes (cascade) | Parent recipe |
| field | varchar | Column that changed |
| old_value | text | Previous value |
| new_value | text | New value |
| changed_by | FK → users | Who made the change |
| changed_at | timestamp | When the change occurred |

**Utility:** Field-level audit trail for recipe modifications. Allows seeing exactly what changed in each version.

---

### Batch Production

#### `batch_groups`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| recipe_id | integer (nullable) | Associated recipe |
| recipe_name | varchar | Snapshot of recipe name |
| batch_count | integer | Number of batches in this run |
| target_weight | decimal | Target output weight |
| piece_weight_value | decimal | Weight per piece |
| pieces_produced | decimal (nullable) | Actual pieces produced |
| leftover_qty | decimal (nullable) | Leftover quantity from run |
| leftover_unit | varchar (default 'kg') | Unit for leftover |
| created_by | varchar (nullable) | Operator snapshot |

**Utility:** Groups multiple batches of the same recipe into one production run. Updating a batch group with `pieces_produced` and `leftover_qty` automatically creates entries in `inventory_items` for the output product and leftover.

---

#### `batches`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| batch_group_id | FK → batch_groups (nullOnDelete) | Parent group |
| recipe_id | FK → recipes | Source recipe |
| recipe_name | varchar | Snapshot |
| lot | varchar (auto-generated) | Format: `{PREFIX}-{DDMMYYYY}-{NNN}` |
| status | enum | `completed` / `failed` |
| input_materials | JSON | Array of materials consumed |
| output_quantity | decimal | Produced output quantity |
| output_unit | varchar | Unit for output |
| quality_score | decimal (nullable) | Synced from quality_controls |
| operator_id | FK → users | Assigned operator |
| operator_name | varchar | Snapshot |
| started_at | date (indexed) | Production start date |
| completed_at | date (nullable) | Completion date |

**Utility:** Core production record. Lot numbers are auto-generated for traceability. Input materials are deducted from inventory on create and restored on delete. Quality score is kept in sync by a model observer.

---

#### `batch_notes`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| batch_id | FK → batches (cascade) | Parent batch |
| text | text | Note content |
| author_id | FK → users | Note author |
| author | varchar | Snapshot |

**Utility:** Collaborative notes on production batches — operators record observations, issues, or actions taken during a production run.

---

#### `quality_controls`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| batch_id | FK → batches (cascade, unique) | Parent batch (1:1) |
| taste | tinyint (1–10) | Taste score |
| texture | tinyint (1–10) | Texture score |
| smell | tinyint (1–10) | Smell score |
| overall_score | decimal (0–100) | Computed overall quality score |
| approved | boolean (indexed) | Pass/fail decision |
| evaluated_by | FK → users | Evaluator |
| evaluator | varchar | Snapshot |
| notes | text (nullable) | Evaluation notes |
| evaluated_at | date | Evaluation date |

**Utility:** Quality control evaluation for each batch. Unique constraint on `batch_id` enforces one QC per batch. A model observer automatically syncs `overall_score` back to `batches.quality_score`.

---

### Sales

#### `customers`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| name | varchar (indexed) | Customer name |
| email | varchar (nullable) | Contact email |
| phone | varchar 50 (nullable) | Phone number |
| address | text (nullable) | Delivery address |

**Utility:** Customer contact database for order management.

---

#### `orders`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| customer_id | FK → customers | Buyer |
| customer_name | varchar | Snapshot |
| total_amount | decimal | Full order value |
| amount_paid | decimal (default 0) | Cumulative payments received |
| amount_returned | decimal (default 0) | Cumulative refunds issued |
| status | enum (indexed) | `pending` / `partial` / `paid` / `shipped` / `cancelled` |
| paid_at | timestamp (nullable) | When fully paid |

**Utility:** Order lifecycle management. Status is auto-updated when payments are recorded: `partial` when partially paid, `paid` when fully paid. Supports multi-payment orders.

---

#### `order_items`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| order_id | FK → orders (cascade) | Parent order |
| product_name | varchar | Product name snapshot |
| quantity | decimal | Quantity ordered |
| unit_price | decimal | Price per unit at time of order |
| total | decimal | Line total |

**Utility:** Line items for each order. Prices are snapshotted to preserve historical accuracy.

---

#### `payments`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| order_id | FK → orders (cascade) | Parent order |
| amount | decimal | Payment amount |
| method | enum | `cash` / `card` / `bank_transfer` / `check` |
| paid_at | date | Payment date |
| created_at | timestamp | Record creation |

**Utility:** Individual payment records per order. Supports partial payments and multiple payment methods on a single order.

---

#### `order_returns`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| order_id | FK → orders (cascade) | Parent order |
| order_item_id | FK → order_items (cascade) | Returned item |
| quantity | decimal | Quantity returned |
| reason | text (nullable) | Return reason |
| refund_amount | decimal (default 0) | Refund issued |
| returned_at | timestamp | When returned |

**Utility:** Tracks product returns and associated refunds. Increments `orders.amount_returned`.

---

### Production Logging

#### `production_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| date | date (unique) | Production date |
| totals | JSON | Daily totals object (totalMilk, totalCheese, yogurt…) |
| batch_id | integer (nullable) | Associated batch |
| recipe_name | varchar (nullable) | Recipe used |
| operator_id | integer (nullable) | Operator |
| operator_name | varchar (nullable) | Snapshot |
| produced_pieces | decimal | Total pieces produced |
| unit | varchar (nullable) | Output unit |
| notes | text (nullable) | Daily notes |
| logged_at | date | Log entry date |

**Utility:** Daily production summary. When a log is created, leftover quantities are automatically added back to the corresponding inventory items.

---

#### `production_log_leftovers`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| log_id | FK → production_logs (cascade) | Parent log |
| item | varchar | Leftover material name |
| amount | decimal | Leftover quantity |
| unit | varchar 50 | Unit |
| notes | text (nullable) | Notes |

**Utility:** Detailed leftover breakdown per production day. Each entry is matched by name to an `inventory_item` and auto-increments its quantity.

---

### Packaging Management

#### `packaging_materials`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| name | varchar | Material name |
| code | varchar (unique) | Internal code/SKU |
| type | enum | `Box` / `Case` / `Vacbag` / `Label` / `Ticket` / `Wrap` / `Wax` |
| stock_qty | decimal | Current stock |
| stock_unit | enum | `pcs` / `kg` / `rolls` |
| low_stock_alert | decimal (nullable) | Alert threshold |
| account_code | integer (nullable) | Accounting reference |
| dim_length / dim_width / dim_height | decimal (nullable) | Physical dimensions |
| notes | text (nullable) | Additional notes |
| last_updated | timestamp | Auto-updated on change |

**Utility:** Library of all packaging materials with stock tracking. Stock is automatically deducted when packaging logs are created.

---

#### `packaging_cartons`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| name | varchar | Carton template name |
| product_name | varchar | Product this carton is used for |
| pieces_per_carton | integer | Pieces that fit per carton |

**Utility:** Template definitions for carton configurations. Each carton defines which materials it requires and in what quantities.

---

#### `carton_materials`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| carton_id | FK → packaging_cartons (cascade) | Parent carton template |
| material_id | FK → packaging_materials (cascade) | Required material |
| amount_per_carton | decimal | Material consumed per carton |

**Utility:** Many-to-many join defining exactly how much of each packaging material is consumed per carton. Used to calculate stock deductions when packaging logs are created.

---

#### `packaging_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | PK | Auto-increment |
| carton_id | FK → packaging_cartons (cascade) | Carton template used |
| date | date | Packaging date |
| cartons_count | integer | Number of cartons packed |
| loose_pieces | integer | Loose pieces not in cartons |
| notes | text (nullable) | Notes |
| created_at | timestamp | Record creation |

**Utility:** Daily packaging execution log. On create, automatically deducts `amount_per_carton × cartons_count` from each material's `stock_qty`. On delete, restores the stock.

---

### System Tables

| Table | Purpose |
|-------|---------|
| `cache` | Laravel application cache store |
| `jobs` | Laravel queue job storage |
| `sessions` | User session storage |
| `password_reset_tokens` | Password reset flow tokens |
| `personal_access_tokens` | Laravel Sanctum API tokens (one per login) |
| `notifications` | In-app notifications (targeted by role or user ID) |

---

## 3. Model Relationships

```
Supplier
  └── hasMany → InventoryItem
        └── hasMany → InventoryHistory

Recipe (SoftDeletes)
  ├── hasMany → RecipeIngredient → belongsTo InventoryItem
  ├── hasMany → RecipeHistory
  └── hasMany → Batch

BatchGroup
  └── hasMany → Batch
        ├── hasMany → BatchNote
        └── hasOne  → QualityControl

Customer
  └── hasMany → Order
        ├── hasMany → OrderItem
        │     └── hasMany → OrderReturn
        └── hasMany → Payment

ProductionLog
  └── hasMany → ProductionLogLeftover

PackagingCarton
  ├── hasMany → CartonMaterial → belongsTo PackagingMaterial
  └── hasMany → PackagingLog

User (referenced by)
  ├── InventoryHistory.changed_by
  ├── RecipeHistory.changed_by
  ├── Batch.operator_id
  ├── BatchNote.author_id
  └── QualityControl.evaluated_by
```

---

## 4. API Routes

All routes are prefixed with `/api` and protected by `auth:sanctum` unless noted.

### Authentication (Public)
| Method | Endpoint | Controller |
|--------|----------|------------|
| POST | `/api/auth/login` | AuthController@login |
| POST | `/api/auth/logout` | AuthController@logout |
| GET | `/api/auth/me` | AuthController@me |

### User Management (`users.read / users.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| GET | `/api/users/{id}` | Get user |
| PUT/PATCH | `/api/users/{id}` | Update user |
| DELETE | `/api/users/{id}` | Delete user |

### Permissions (`permissions.read / permissions.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/permissions` | List permissions |
| POST | `/api/permissions` | Create permission |

### Suppliers (`suppliers.read / suppliers.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/suppliers` | List suppliers |
| POST | `/api/suppliers` | Create supplier |
| GET/PUT/DELETE | `/api/suppliers/{id}` | CRUD |

### Inventory (`inventory.read / inventory.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/inventory` | List items (filterable by type/status) |
| POST | `/api/inventory` | Create item |
| GET | `/api/inventory/history/all` | Full audit history |
| GET/PUT/DELETE | `/api/inventory/{id}` | CRUD |

### Recipes (`recipes.read / recipes.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/recipes` | List all (with ingredients & history) |
| POST | `/api/recipes` | Create recipe + ingredients |
| GET/PUT/DELETE | `/api/recipes/{id}` | CRUD |

### Batches (`batches.read / batches.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/batches` | List batches |
| POST | `/api/batches` | Create batch (deducts inventory) |
| GET/PUT/DELETE | `/api/batches/{id}` | CRUD |
| POST | `/api/batches/{id}/notes` | Add note to batch |

### Batch Groups (`batches.read / batches.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/batch-groups` | List groups with batches |
| POST | `/api/batch-groups` | Create group |
| PUT/PATCH | `/api/batch-groups/{id}` | Update (triggers inventory on completion) |
| DELETE | `/api/batch-groups/{id}` | Delete group + batches |

### Quality Controls (`quality.read / quality.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/quality-controls` | List QC records |
| POST | `/api/quality-controls` | Create QC (syncs score to batch) |
| GET/PUT/DELETE | `/api/quality-controls/{id}` | CRUD |

### Customers (`customers.read / customers.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/customers` | List customers |
| POST | `/api/customers` | Create customer |
| GET/PUT/DELETE | `/api/customers/{id}` | CRUD |

### Orders (`sales.read / sales.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/orders` | List orders (with items, payments, returns) |
| POST | `/api/orders` | Create order with line items |
| GET/PUT/DELETE | `/api/orders/{id}` | CRUD |
| POST | `/api/orders/{id}/payments` | Record payment (auto-updates status) |
| POST | `/api/orders/{id}/returns` | Record return |
| PATCH | `/api/orders/{id}/status` | Explicit status update |

### Production Logs (`batches.read / batches.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/production-logs` | Last 30 days |
| POST | `/api/production-logs` | Create log (auto-restores leftovers to inventory) |
| DELETE | `/api/production-logs/{id}` | Delete log |

### Packaging (`inventory.read / inventory.write`)
| Method | Endpoint | Action |
|--------|----------|--------|
| GET/POST | `/api/packaging/materials` | Materials CRUD |
| GET/PUT/DELETE | `/api/packaging/materials/{id}` | Material detail |
| GET/POST | `/api/packaging/cartons` | Carton templates CRUD |
| GET/PUT/DELETE | `/api/packaging/cartons/{id}` | Carton detail |
| GET/POST | `/api/packaging/logs` | Packaging logs CRUD |
| DELETE | `/api/packaging/logs/{id}` | Delete log (restores stock) |

### Analytics & Notifications
| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/analytics/dashboard` | KPI dashboard data |
| GET | `/api/notifications` | List notifications |
| PATCH | `/api/notifications/{id}/read` | Mark notification as read |

---

## 5. Feature Modules

### Inventory Management
- Track raw materials, packaging, leftovers, and finished products
- Auto-status calculation (`ok` / `low` / `out`) on every save
- Full audit trail via `inventory_history`
- Lot & code tracking for traceability
- Lead time tracking per supplier
- Quantities auto-deducted by batch creation, auto-restored by batch deletion

### Recipe Management
- Multi-version recipes (version counter incremented on every update)
- Ingredient lists with snapshotted prices and names
- Production steps as ordered JSON array
- Packaging info as JSON array
- Soft deletes for archival
- Field-level change history via `recipe_history`
- Status: `semi_final` → `final`

### Batch Production
- Grouped production runs via `batch_groups`
- Auto-generated lot numbers: `{PREFIX}-{DDMMYYYY}-{SEQ}`
- Input material consumption tracked in JSON
- Output quantity & unit recorded
- Operator assignment (from JWT, not spoofable)
- Collaborative batch notes
- Status: `completed` / `failed`
- Automatic inventory deduction on create; restoration on delete

### Quality Control
- Taste, texture, smell scored 1–10
- Overall score (0–100)
- Approval decision (boolean)
- 1:1 unique constraint with batch
- Model observer syncs `overall_score` → `batches.quality_score`
- Evaluator captured from JWT

### Sales & Orders
- Customer profiles with contact info
- Orders with line items (price snapshotted at order time)
- Multi-payment support (cash, card, bank transfer, check)
- Auto-status: `pending` → `partial` → `paid`
- Manual status: `shipped` / `cancelled`
- Return & refund tracking

### Production Logging
- Daily production summaries
- Produced pieces count
- Leftover item logging (item, amount, unit)
- Leftovers auto-returned to inventory by name matching

### Packaging Management
- Material library with type, dimensions, account code, stock alerts
- Carton templates defining material composition
- Daily packaging logs that auto-deduct material stock
- Stock restoration on log deletion

### Analytics & Reporting
- Dashboard KPIs: recent batches, inventory status, quality metrics
- Production trend charts
- Sales and revenue reporting

### Access Control
- Three roles: `admin`, `supervisor`, `operator`
- Granular `module.read` / `module.write` permissions
- `write` implies `read`; `admin` bypasses all checks
- Permissions stored as JSON array in `users.permissions`
- Frontend: `ProtectedRoute` HOC checks before rendering
- Backend: middleware verifies per-route

---

## 6. Frontend Pages & Structure

### Pages

| Route | Page File | Permission Required | Description |
|-------|-----------|---------------------|-------------|
| `/` | `Dashboard.tsx` | `analytics.read` | KPI overview, recent batches, stock alerts |
| `/inventory` | `Inventory.tsx` | `inventory.read` | Stock management for all material types |
| `/recipes` | `Recipes.tsx` | `recipes.read` | Recipe formulas, ingredients, versioning |
| `/batches` | `Batches.tsx` | `batches.read` | Batch production tracking |
| `/pieces-produced` | `PiecesProduced.tsx` | `batches.read` | Output tracking per production run |
| `/leftover` | `Leftover.tsx` | `batches.read` | Leftover/waste management |
| `/quality` | `Quality.tsx` | `quality.read` | QC evaluations and approval records |
| `/estimation` | `Estimation.tsx` | `inventory.read` | Pre-production feasibility planning |
| `/packaging/materials` | `PackagingMaterials.tsx` | `inventory.read` | Packaging material stock & specs |
| `/packaging/cartons` | `PackagingCartons.tsx` | `inventory.read` | Carton templates & material composition |
| `/packaging/log` | `PackagingLog.tsx` | `inventory.read` | Daily packaging execution logs |
| `/customers` | `Customers.tsx` | `customers.read` | Customer profiles & order history |
| `/suppliers` | `Suppliers.tsx` | `suppliers.read` | Supplier management |
| `/sales` | `Sales.tsx` | `sales.read` | Orders, payments, returns |
| `/analytics` | `Analytics.tsx` | `analytics.read` | Charts, trends, KPIs |
| `/users` | `UserManagement.tsx` | `users.read` | User account & role management |
| `/permissions` | `Permissions.tsx` | `users.read` | Permission string management |
| `*` | `NotFound.tsx` | None | 404 fallback |
| `/login` | `Login.tsx` | None | Public authentication form |

### Layout Components

| File | Purpose |
|------|---------|
| `AppLayout.tsx` | Main shell: sidebar + topbar wrapper |
| `AppSidebar.tsx` | Navigation sidebar with grouped menu items |
| `Topbar.tsx` | User avatar, notifications bell, logout |
| `ProtectedRoute.tsx` | HOC — checks permission before rendering page |

### Shared Components

| File | Purpose |
|------|---------|
| `DataStates.tsx` | Loading spinner, error state, empty state UIs |
| `KpiCard.tsx` | Dashboard KPI metric card |
| `StatusBadge.tsx` | Colored status indicator pill |
| `NavLink.tsx` | Active-aware sidebar navigation link |

### Services / API Layer

Each feature module has a dedicated API service file:

```
src/services/
  authService.ts
  inventoryService.ts
  recipeService.ts
  batchService.ts
  batchGroupService.ts
  qualityService.ts
  customerService.ts
  orderService.ts
  supplierService.ts
  productionLogService.ts
  packagingService.ts
  userService.ts
  analyticsService.ts
```

**`apiClient.ts`** — Shared Axios instance:
- Injects Sanctum bearer token on every request
- Converts request body from camelCase → snake_case
- Converts response data from snake_case → camelCase

### State & Auth

| File | Purpose |
|------|---------|
| `AuthContext.tsx` | Global auth state: current user, token, login/logout, permission check |

---

## 7. Access Control System

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full access to everything — bypasses all permission checks |
| `supervisor` | Typically has read access to all modules + write on production |
| `operator` | Limited access — usually restricted to production & quality |

### Permission Format

Permissions follow the pattern `module.action`:

| Module | Permissions |
|--------|-------------|
| users | `users.read`, `users.write` |
| inventory | `inventory.read`, `inventory.write` |
| recipes | `recipes.read`, `recipes.write` |
| batches | `batches.read`, `batches.write` |
| quality | `quality.read`, `quality.write` |
| sales | `sales.read`, `sales.write` |
| customers | `customers.read`, `customers.write` |
| suppliers | `suppliers.read`, `suppliers.write` |
| analytics | `analytics.read` |
| permissions | `permissions.read`, `permissions.write` |

**Inheritance rule:** Having `module.write` automatically grants `module.read`.  
**Admin bypass:** `admin` role always returns `true` for `hasPermission()`.

---

## 8. Key Architectural Patterns

### Snapshot Pattern
Names and prices are denormalized into related records at time of creation (e.g. `order_items.product_name`, `batches.recipe_name`, `batches.operator_name`). This ensures historical records remain accurate even if the source data changes later.

### JSON Columns
Ordered or variable-length data is stored as JSON arrays: `recipes.steps`, `recipes.packages`, `batches.input_materials`, `users.permissions`. Avoids extra join tables for data that is always accessed as a unit.

### Immutable Audit Tables
`inventory_history` and `recipe_history` records are only inserted, never updated or deleted. They provide a complete immutable audit trail.

### Model Observers / Boot Hooks
- `InventoryItem` — auto-calculates `status` on every save
- `QualityControl` — observer syncs `overall_score` back to `batches.quality_score`
- `Batch` — boot method deducts inventory on create, restores on delete
- `PackagingLog` — deducts material stock on create, restores on delete

### Transactional Operations
Packaging log creation uses `DB::transaction()` to ensure material deductions are atomic — either all succeed or none are applied.

### JWT from Token Only
Sensitive fields like `operator_id`, `changed_by`, `evaluated_by`, and `author_id` are always extracted from the Sanctum token — never from the request body — preventing privilege escalation or impersonation.

### Soft Deletes
Only `recipes` use `SoftDeletes`. All other models are hard-deleted. This allows recipe archiving while keeping the database clean.

### Eager Loading
All index and show endpoints eager-load their relationships to avoid N+1 query problems (e.g. `Batch::with(['notes', 'qualityControl', 'recipe'])`).

### Lot Auto-Generation
Batch lot numbers are generated as `{RECIPE_PREFIX}-{DDMMYYYY}-{SEQ}` where SEQ is zero-padded and increments per-day. Guarantees unique, traceable lot codes without UUIDs.

---

*Last updated: 2026-04-14*
