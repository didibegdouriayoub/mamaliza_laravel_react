# Architecture — Fromagerie Management System

## Overview

```
┌────────────────────────────────────────────────────────┐
│                     Browser (React SPA)                 │
│  pages/ → services/ → fetch() → REST API               │
└────────────────────────┬───────────────────────────────┘
                         │ HTTPS + JWT Bearer
┌────────────────────────▼───────────────────────────────┐
│              Laravel 11 REST API (PHP 8.3)              │
│                                                          │
│  Auth · Users · Inventory · Suppliers · Recipes         │
│  Batches · Quality · Orders · Customers                 │
│  ProductionLogs · Analytics · Notifications             │
└────────────────────────┬───────────────────────────────┘
                         │ Eloquent ORM
┌────────────────────────▼───────────────────────────────┐
│                   MySQL 8.0 Database                    │
└─────────────────────────────────────────────────────────┘
```

---

## Frontend

### Stack
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Routing | React Router v6 |
| Styling | TailwindCSS + shadcn/ui |
| State | Local `useState` / `useEffect` per page |
| Server cache | `@tanstack/react-query` (installed, not yet used) |
| Charts | Recharts |
| Animations | Framer Motion |

### Directory Structure
```
src/
├── pages/          # One file per route (Dashboard, Inventory, Recipes, …)
├── services/       # API abstraction layer (currently mock, needs real HTTP)
├── contexts/       # AuthContext — user, session, permissions
├── models/         # TypeScript types shared across app (types.ts)
├── components/
│   ├── layout/     # AppLayout, sidebar, nav
│   └── ui/         # shadcn primitives
├── data/           # mockData.ts  ← remove progressively
└── hooks/          # use-toast, use-mobile
```

### Service Layer Pattern (current → target)

**Current (mock):**
```ts
async getAll(): Promise<X[]> {
  await delay(300);
  return [...localArray];
}
```

**Target (real API):**
```ts
const BASE = import.meta.env.VITE_API_URL; // e.g. http://localhost:8000

async getAll(): Promise<X[]> {
  const res = await fetch(`${BASE}/api/inventory`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Auth Flow (target)
```
Login form
  → POST /api/auth/login { email, password }
  ← { token, user }
  → Store token in localStorage / httpOnly cookie
  → Set Authorization header on all subsequent requests
  → GET /api/auth/me on app mount to restore session
```

### React Query Migration (recommended)
`@tanstack/react-query` is already installed. Replace the manual `loadData()` / `useEffect` pattern with `useQuery` and `useMutation` per resource to get:
- Automatic caching & background refetch
- Loading / error states out of the box
- Optimistic updates for mutations

---

## Backend

### Stack

| Layer | Technology |
|---|---|
| Language | PHP 8.3 |
| Framework | Laravel 11 |
| Database | MySQL 8.0 |
| ORM | Eloquent |
| Auth | Laravel Sanctum (token-based) |
| Queue | Laravel Queues + database driver (notifications, side-effects) |
| Testing | PHPUnit + Pest |
| API Style | RESTful JSON |
| Docs | Scribe (auto-generates OpenAPI from routes) |

### Auth Strategy
- Issue **JWT** on login (`HS256` or `RS256`)
- Store user `id`, `role`, `permissions[]` in JWT payload
- All protected routes require `Authorization: Bearer <token>` header
- Refresh token (optional v1): 15-min access + 7-day refresh

### Database Schema (core tables)

> Full schema detail with indexes and foreign keys: see `database-schema.md`

```
users                  → roles: admin | supervisor | operator
suppliers              → linked from inventory
inventory_items        → with min_stock alerts
inventory_history      → audit trail per field change
recipes                → versioned
recipe_history         → audit trail
recipe_ingredients     → pivot: recipe ↔ inventory_item
batches                → status machine; linked to recipe + operator
batch_notes            → per-batch notes
quality_controls       → 1:1 per batch
customers
orders                 → status machine linked to customer
order_items            → pivot: order ↔ product
payments               → many per order
order_returns          → many per order
production_logs        → actual output per batch
production_log_leftovers
notifications          → per user
```

### Key Business Rules (backend must enforce)

1. **Inventory deduction** — when a batch transitions `draft → in_production`, deduct `inputMaterials` quantities from inventory and write history records.
2. **Batch quality score sync** — when a `QualityControl` record is created, `UPDATE batches SET quality_score = overallScore WHERE id = batchId`.
3. **Order status auto-update** — when total payments `≥ totalAmount`, set order `status = 'paid'`; otherwise `status = 'partial'`.
4. **Low-stock notification** — after any inventory update, if `quantity ≤ minStock`, create a `Notification` for all admins/supervisors.
5. **Batch failure notification** — when a batch status changes to `failed`, notify the operator's supervisor.
6. **`changedBy` from auth token** — never accept `changedBy` from the request body; always derive it server-side from the JWT `userId`.

---

## Environment Variables

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:8000
```

### Backend (`backend/.env`)
```
APP_NAME=Fromagerie
APP_ENV=local
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=fromagerie
DB_USERNAME=root
DB_PASSWORD=

SANCTUM_STATELESS_DOMAINS=localhost:5173
```

---

## API Base URL Convention

```
/api/auth/...
/api/users/...
/api/inventory/...
/api/suppliers/...
/api/recipes/...
/api/batches/...
/api/quality/...
/api/orders/...
/api/customers/...
/api/production-logs/...
/api/analytics/...
/api/notifications/...
```

All endpoints return JSON. Errors use standard HTTP status codes with `{ error: string }` body.
