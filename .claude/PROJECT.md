# PROJECT.md — Fromagerie Management System

## Overview
A full-stack cheese factory (fromagerie) management system. Covers the entire production lifecycle: raw material inventory → recipes → batch production → quality control → sales.

## Business Domain
- **Industry:** Cheese / dairy manufacturing (fromagerie)
- **Users:** Admin, Supervisor, Operator roles with granular permissions
- **Core Workflow:** Purchase ingredients → store in inventory → define recipes → produce batches → evaluate quality → sell to customers

## Architecture
```
frontend/   React 18 + Vite + TypeScript SPA (port 5173)
backend/    Laravel 13 REST API (port 8000)
db/         MySQL 8.0 (port 33061 externally)
```
All three run in Docker containers via `docker-compose.yml`.

## Key Modules

| Module | Route | Description |
|---|---|---|
| Dashboard | `/` | KPIs, recent batches, inventory status |
| Inventory | `/inventory` | Raw materials & packaging stock management |
| Recipes | `/recipes` | Recipe formulas with ingredients, steps, packaging |
| Batches | `/batches` | Production batch tracking (draft → in_production → completed/failed) |
| Production | `/production` | Production logs, leftover tracking |
| Quality | `/quality` | Taste/texture/smell evaluations per batch |
| Estimation | `/estimation` | Pre-production planning & stock feasibility |
| Sales | `/sales` | Orders, payments, returns |
| Customers | `/customers` | Customer contact management |
| Suppliers | `/suppliers` | Supplier management |
| Analytics | `/analytics` | Charts and KPI reporting |
| Users | `/users` | User management + permission assignment |
| Permissions | `/permissions` | Granular permission registry |

## Directory Structure
```
mamaliza_laravel_react/
├── backend/
│   ├── app/
│   │   ├── Http/Controllers/   # 14 REST controllers
│   │   ├── Http/Middleware/    # CheckPermission.php
│   │   ├── Models/             # 19 Eloquent models
│   │   ├── Observers/          # 3 model observers
│   │   └── Services/           # 3 domain services
│   ├── database/
│   │   ├── migrations/         # 30+ migrations
│   │   └── seeders/
│   └── routes/
│       └── api.php             # 86 endpoints
├── frontend/
│   └── src/
│       ├── pages/              # 16 page components
│       ├── services/           # 13 API service modules
│       ├── contexts/           # AuthContext.tsx
│       ├── components/
│       │   ├── layout/         # AppLayout, Sidebar, Topbar
│       │   └── ui/             # shadcn/ui primitives (35+)
│       ├── models/types.ts     # TypeScript interfaces & enums
│       └── lib/apiClient.ts    # HTTP client with auth + case conversion
├── project-spec/               # Original design docs (may be outdated)
│   ├── tasks.md
│   ├── features.md
│   ├── database-schema.md
│   └── api-spec.md
└── docker-compose.yml
```

## Development Phases Completed
All 11 phases completed:
- Phase 0: Backend setup + CORS + migrations
- Phase 1: Authentication (Sanctum JWT)
- Phase 2: Service layer (mock → real API)
- Phase 3: CRUD endpoints for all resources
- Phase 4: Business logic (inventory deduction, quality sync, notifications)
- Phase 5: Frontend feature completion
- Phase 6: Permission guards
- Phase 7: Missing modules (Permissions, Notifications, Customers, Suppliers, Estimation)
- Phase 8: Bug fixes
- Phase 9: Inventory-Batch integration + lot/code + auto-status
- Phase 10: Recipe enhancements (target_weight, piece_weight, packaging, recipe_status)
- Phase 11: Granular RBAC (module.read / module.write)

## Running the Project
```bash
docker-compose up -d
# Backend:  http://localhost:8000
# Frontend: http://localhost:5173
# MySQL:    localhost:33061

# Reset & reseed
docker exec fromagerie_backend php artisan migrate:refresh --seed
```
