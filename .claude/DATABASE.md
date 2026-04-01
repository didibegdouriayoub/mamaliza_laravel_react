# DATABASE.md — Schema, Relationships & Decisions

## Connection
- **Engine:** MySQL 8.0
- **Database:** `fromagerie`
- **User:** `fromagerie` / `secret`
- **Host (Docker internal):** `db:3306`
- **Host (external):** `localhost:33061`

---

## Tables & Schemas

### `users`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | varchar | |
| email | varchar unique | |
| password | varchar | bcrypt hashed |
| role | enum | `admin`, `supervisor`, `operator` |
| permissions | JSON | Array of permission strings e.g. `["inventory.read","batches.write"]` |
| avatar | varchar nullable | |
| remember_token | varchar nullable | |
| timestamps | | |

**Relationships:** hasMany batches (as operator), hasMany inventory_history (changed_by), hasMany recipe_history

---

### `suppliers`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | varchar | |
| contact | varchar nullable | |
| email | varchar nullable | |
| timestamps | | |

**Relationships:** hasMany inventory_items

---

### `inventory_items`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | varchar | |
| type | enum | `raw`, `packaging` |
| quantity | decimal | |
| unit | varchar | default `kg` |
| price | decimal | per unit |
| supplier_id | FK → suppliers | nullable |
| min_stock | decimal | threshold for low-stock alert |
| lot | varchar nullable | lot number |
| code | varchar nullable | internal product code |
| status | enum | `ok`, `low`, `out` — auto-calculated on save |
| created_at | timestamp | can be overridden via API (historical import) |
| updated_at | timestamp | |

**Relationships:** belongsTo supplier, hasMany inventory_history
**Observer:** `InventoryItemObserver` auto-sets `status` on saving based on `quantity` vs `min_stock`

---

### `inventory_history`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| item_id | FK → inventory_items | |
| field | varchar | which field changed |
| old_value | text nullable | |
| new_value | text nullable | |
| changed_by | bigint FK → users | always from JWT, never from request body |
| changed_at | timestamp | |

> No `updated_at`. `changed_at` is set on creation.

---

### `recipes`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | varchar | |
| description | text nullable | |
| target_weight | decimal nullable | formerly `yield` |
| piece_weight | decimal nullable | formerly `yield_unit` |
| recipe_status | enum | `semi_final`, `final` |
| steps | JSON nullable | array of step strings |
| packages | JSON nullable | array of package objects |
| version | integer default 1 | incremented on edit |
| timestamps | | |

**Relationships:** hasMany recipe_ingredients, hasMany recipe_history, hasMany batches

---

### `recipe_ingredients`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| recipe_id | FK → recipes | |
| material_id | FK → inventory_items nullable | |
| material_name | varchar | snapshot at time of recipe save |
| quantity | decimal | |
| unit | varchar | |
| unit_price | decimal | snapshot at time of recipe save |

> No timestamps. Historical data captured via `recipe_history`.

---

### `recipe_history`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| recipe_id | FK → recipes | |
| field | varchar | which field changed |
| old_value | text nullable | |
| new_value | text nullable | |
| changed_by | bigint FK → users | from JWT |
| changed_at | timestamp | |

---

### `batches`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| recipe_id | FK → recipes nullable | |
| recipe_name | varchar | snapshot |
| status | enum | `draft`, `in_production`, `completed`, `failed` |
| input_materials | JSON | array of `{id, name, quantity, unit}` |
| output_quantity | decimal nullable | |
| output_unit | varchar nullable | |
| quality_score | decimal nullable | synced from quality_controls |
| operator_id | FK → users nullable | |
| operator_name | varchar nullable | snapshot |
| started_at | timestamp nullable | |
| completed_at | timestamp nullable | |
| timestamps | | |

**Relationships:** belongsTo recipe, belongsTo operator (user), hasMany batch_notes, hasOne quality_control
**Observer:** `BatchObserver`
**Side Effects:** On create → deduct `input_materials` from inventory + write inventory_history. On delete → restore quantities.

---

### `batch_notes`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| batch_id | FK → batches | |
| text | text | |
| author | varchar | |
| created_at | timestamp | |

---

### `quality_controls`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| batch_id | FK → batches unique | 1:1 with batch |
| taste | integer | 1–5 score |
| texture | integer | 1–5 score |
| smell | integer | 1–5 score |
| overall_score | decimal | average of taste/texture/smell |
| approved | boolean | |
| evaluated_by | FK → users | |
| evaluator | varchar | snapshot |
| notes | text nullable | |
| evaluated_at | timestamp | |

**Observer:** `QualityControlObserver` → on saved: writes `overall_score` back to `batches.quality_score`

---

### `customers`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | varchar | |
| email | varchar nullable | |
| phone | varchar nullable | |
| address | text nullable | |
| timestamps | | |

**Relationships:** hasMany orders

---

### `orders`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| customer_id | FK → customers | |
| customer_name | varchar | snapshot |
| total_amount | decimal | |
| amount_paid | decimal default 0 | |
| amount_returned | decimal default 0 | |
| status | enum | `pending`, `partial`, `paid`, `shipped`, `cancelled` |
| paid_at | timestamp nullable | |
| timestamps | | |

**Relationships:** belongsTo customer, hasMany order_items, hasMany payments, hasMany order_returns
**Business Logic:** Status auto-updated when payment is recorded (`partial` or `paid`)

---

### `order_items`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| order_id | FK → orders | |
| product_name | varchar | |
| quantity | decimal | |
| unit_price | decimal | |
| total | decimal | calculated (quantity × unit_price) |

---

### `payments`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| order_id | FK → orders | |
| amount | decimal | |
| method | varchar | |
| paid_at | timestamp | |

---

### `order_returns`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| order_id | FK → orders | |
| product_name | varchar | |
| quantity | decimal | |
| refund_amount | decimal | |
| reason | text nullable | |
| returned_at | timestamp | |

---

### `production_logs`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| batch_id | FK → batches nullable | |
| pieces_produced | integer | |
| notes | text nullable | |
| timestamps | | |

**Relationships:** hasMany production_log_leftovers

---

### `production_log_leftovers`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| production_log_id | FK → production_logs | |
| item_id | FK → inventory_items | |
| item_name | varchar | snapshot |
| quantity | decimal | leftover amount |
| unit | varchar | |

---

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| title | varchar | |
| message | text | |
| type | enum | `warning`, `error`, `info`, `success` |
| read_at | timestamp nullable | null = unread |
| created_at | timestamp | |

---

### `permissions`
| Column | Type | Notes |
|---|---|---|
| id | bigint PK | |
| name | varchar unique | e.g. `inventory.read` |
| description | varchar nullable | |
| timestamps | | |

---

## Key Relationships Map
```
users ──────────────────── batches (operator_id)
users ──────────────────── inventory_history (changed_by)
users ──────────────────── recipe_history (changed_by)
users ──────────────────── quality_controls (evaluated_by)

suppliers ──────────────── inventory_items
inventory_items ─────────── inventory_history
inventory_items ─────────── recipe_ingredients (material_id)

recipes ────────────────── recipe_ingredients
recipes ────────────────── recipe_history
recipes ────────────────── batches

batches ────────────────── batch_notes
batches ─────────────────1 quality_controls (unique)
batches ────────────────── production_logs

customers ──────────────── orders
orders ─────────────────── order_items
orders ─────────────────── payments
orders ─────────────────── order_returns

production_logs ─────────── production_log_leftovers
```

---

## Design Decisions

1. **Snapshot pattern:** `recipe_name`, `operator_name`, `customer_name`, `material_name`, `evaluator` are denormalized copies. Ensures historical records remain accurate if the original is renamed or deleted.

2. **JSON columns for arrays:** `steps`, `packages` in recipes and `input_materials` in batches use JSON instead of join tables — simpler for ordered arrays with no query needs on individual elements.

3. **User permissions as JSON array:** `users.permissions` stores an array of permission strings rather than a join table. Simple, fast, sufficient for the scale of this app.

4. **`changed_by` always from JWT:** History tables (`inventory_history`, `recipe_history`) get `changed_by` from the authenticated user, never from the request body — prevents spoofing.

5. **Write → Read permission inheritance:** Having `module.write` implies having `module.read`. Enforced on both backend middleware and frontend `hasPermission()`.

6. **`created_at` override in inventory:** Allows importing historical stock entries with their original timestamps via `POST /api/inventory` with an explicit `created_at` field.

7. **Quality control is 1:1 with batch:** Enforced via unique constraint on `quality_controls.batch_id`.
