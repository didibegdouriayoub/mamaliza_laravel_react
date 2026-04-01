# PROGRESS.md — What's Done / What's Next

## Overall Status
**11 of 11 phases complete.** Core feature set implemented. Project is functionally complete but may have bugs and rough edges that need polishing.

---

## Completed Phases

### Phase 0 — Backend Setup ✅
MySQL + Laravel + Docker, CORS, migrations, error handler.

### Phase 1 — Authentication ✅
Sanctum login/logout/me, JWT storage in localStorage, session restore on reload, 401 redirect.

### Phase 2 — Service Layer ✅
All 13 services use real HTTP calls. No more mock data in services.

### Phase 3 — CRUD Endpoints ✅
All resources have full CRUD: inventory, recipes, batches, quality, orders, users, suppliers, customers, production logs.

### Phase 4 — Business Logic ✅
- Inventory auto-deduction on batch creation
- Inventory restoration on batch deletion
- Quality score sync to batch via observer
- Order status auto-update on payment
- Low-stock notifications
- Batch failure notifications
- `changed_by` always from JWT

### Phase 5 — Frontend Feature Completion ✅
Replaced all mock data with live service calls across: Inventory, Recipes, Batches, Quality, Dashboard, Analytics, Sales, Users, Production.

### Phase 6 — Permission Guards ✅
Frontend guards on all action buttons. Backend middleware on all protected routes.

### Phase 7 — Missing Modules ✅
Permissions page, Customers page, Suppliers page, Notifications bell + panel, Estimation → Batches, Production leftover → Inventory return.

### Phase 8 — Bug Fixes ✅
Idempotent seeders, permissions endpoint, inventory loading, recipe NaN, batch started_at, quality evaluator validation, inventory update, change history recording.

### Phase 9 — Inventory-Batch Integration ✅
Auto inventory deduction/restoration, lot/code fields, default unit `kg`, inventory name autocomplete, dynamic stock status, filter by status, `created_at` override.

### Phase 10 — Recipe Enhancements ✅
`target_weight` / `piece_weight` (renamed from yield), `recipe_status` (semi_final/final), `packages` JSON, UI updated, history tracking verified.

### Phase 11 — Granular RBAC ✅
`module.read` / `module.write` permission naming, write→read inheritance, sidebar guards, button guards, user permission selector, migration for existing users.

---

## Known / Potential Issues

These were not explicitly tracked as bugs but may need investigation:

| Area | Potential Issue | Priority |
|---|---|---|
| Docker frontend port | `5173:8080` mapping — Vite dev server may run on different port inside container | 🔴 |
| `@tanstack/react-query` | Installed but not wired up — all data fetching is manual | 🟡 |
| `features.md` in project-spec | Very outdated — reflects pre-phase-2 state | 🟢 |
| Error handling on forms | Unclear if all API error messages surface correctly to the user | 🟡 |
| Batch notes API endpoint | `POST /api/batches/{id}/notes` exists in routes but needs frontend verification | 🟡 |
| Estimation page | Complex logic — may have edge cases with packaging ratios | 🟡 |
| Analytics endpoint | `/api/analytics/dashboard` — needs verification data is correct | 🟡 |
| Production log leftovers → inventory | Return-to-inventory flow implemented but needs end-to-end test | 🟡 |
| Order payments / returns | Multiple payments per order + returns — accounting logic needs verification | 🟡 |

---

## What's Next (Backlog / Phase 12+)

### High Priority (Bugs / Polish)
- [ ] Audit and test all pages end-to-end after all phases
- [ ] Fix any remaining 404/500 errors surfaced during testing
- [ ] Ensure Docker frontend port mapping is correct

### Medium Priority (UX Improvements)
- [ ] Wire up `@tanstack/react-query` for caching & loading states
- [ ] Add proper loading skeletons across all pages
- [ ] Add form validation error display (API errors surfaced in forms)
- [ ] Pagination on large lists (inventory, orders, batches)
- [ ] Search functionality on more pages (currently limited)

### Low Priority (Nice to Have)
- [ ] Print views for more modules (batch sheet exists, others?)
- [ ] Export to CSV/PDF
- [ ] Dark mode (Tailwind already configured)
- [ ] Real-time notifications (WebSocket or polling)
- [ ] Email notifications for low stock / batch failure
- [ ] Save/name estimations (currently in-memory only)
- [ ] Mobile responsiveness audit
