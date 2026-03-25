# API Specification — Fromagerie (Laravel 11)

> Base URL: `http://localhost:8000/api`  
> Auth: All routes (except login) require `Authorization: Bearer {token}`  
> Content-Type: `application/json`  
> Errors: `{ "message": "string", "errors": {} }` with appropriate HTTP status

---

## Auth

### `POST /api/auth/login`
Login and receive a Sanctum token.

**Request**
```json
{ "email": "marie@fromagerie.com", "password": "secret" }
```
**Response `200`**
```json
{
  "token": "1|abc...",
  "user": {
    "id": 1, "name": "Marie Dupont", "email": "marie@fromagerie.com",
    "role": "admin", "permissions": ["manage_inventory", "manage_users"]
  }
}
```
**Errors:** `422` invalid credentials

---

### `GET /api/auth/me`
Return auth user from token.
**Response `200`** → same `user` object as login

---

### `POST /api/auth/logout`
Revoke current token.
**Response `204`** No Content

---

## Users

### `GET /api/users`
List all users. **Permission:** `manage_users`

**Response `200`**
```json
[{ "id": 1, "name": "Marie Dupont", "email": "...", "role": "admin", "permissions": [...] }]
```

---

### `POST /api/users`
Create a user. **Permission:** `manage_users`

**Request**
```json
{ "name": "Jean Martin", "email": "jean@fromagerie.com", "password": "secret", "role": "supervisor" }
```
**Response `201`** → created user object

---

### `PATCH /api/users/{id}/role`
**Permission:** `manage_users`

**Request** `{ "role": "supervisor" }` → auto-assigns default permissions for role
**Response `200`** → updated user

---

### `PATCH /api/users/{id}/permissions`
**Permission:** `manage_users`

**Request** `{ "permissions": ["manage_batches", "manage_quality"] }`
**Response `200`** → updated user

---

### `DELETE /api/users/{id}`
**Permission:** `manage_users` | **Response `204`**

---

## Inventory

### `GET /api/inventory`
**Query params:** `?search=milk&type=raw&date=2025-03-01`

**Response `200`**
```json
[{
  "id": 1, "name": "Whole Milk", "type": "raw",
  "quantity": 500.0, "unit": "liters", "price": 0.85,
  "supplier_id": 1, "supplier": { "id": 1, "name": "Ferme Dupont" },
  "min_stock": 100.0,
  "history": [],
  "created_at": "2025-01-10", "updated_at": "2025-03-01"
}]
```

---

### `POST /api/inventory`
**Permission:** `manage_inventory`

**Request**
```json
{
  "name": "Whole Milk", "type": "raw", "quantity": 500,
  "unit": "liters", "price": 0.85, "supplier_id": 1, "min_stock": 100
}
```
**Response `201`** → created item (triggers low-stock check)

---

### `PUT /api/inventory/{id}`
**Permission:** `manage_inventory`

**Request** — send only the fields you want to update:
```json
{ "quantity": 350, "price": 0.90 }
```
**Backend side-effects:**
1. Computes diff → appends rows to `inventory_history` with `changed_by` from JWT
2. If new `quantity ≤ min_stock` → creates `Notification` for all admins/supervisors

**Response `200`** → updated item with history

---

### `DELETE /api/inventory/{id}`
**Permission:** `manage_inventory` | **Response `204`**

---

### `GET /api/inventory/{id}/history`
Returns the `inventory_history` rows for an item, sorted latest-first.

---

## Suppliers

### `GET /api/suppliers`
**Response `200`** → array of suppliers

### `POST /api/suppliers`
**Request** `{ "name": "Ferme Dupont", "contact": "Jean", "email": "j@ferme.com" }`
**Response `201`**

### `PUT /api/suppliers/{id}` | **Response `200`**
### `DELETE /api/suppliers/{id}` | **Response `204`**

---

## Recipes

### `GET /api/recipes`
**Response `200`**
```json
[{
  "id": 1, "name": "Camembert Classique", "description": "...",
  "yield": 12, "yield_unit": "wheels", "version": 2,
  "ingredients": [{ "material_id": 1, "material_name": "Whole Milk", "quantity": 100, "unit": "liters", "unit_price": 0.85 }],
  "steps": ["Heat milk to 32°C", "Add starter culture"],
  "history": [],
  "created_at": "2025-01-01", "updated_at": "2025-03-10"
}]
```

---

### `POST /api/recipes`
**Permission:** `manage_recipes`

**Request**
```json
{
  "name": "Brie de Meaux", "description": "...", "yield": 8, "yield_unit": "wheels",
  "ingredients": [{ "material_id": 1, "quantity": 80, "unit": "liters", "unit_price": 0.85 }],
  "steps": ["Step 1", "Step 2"]
}
```
**Response `201`** → created recipe with `version: 1`

---

### `PUT /api/recipes/{id}`
**Permission:** `manage_recipes`

Send changed fields. Backend:
1. Increments `version`
2. Appends `recipe_history` rows with `changed_by` from JWT

**Response `200`** → updated recipe

---

### `DELETE /api/recipes/{id}`
**Permission:** `manage_recipes` | **Response `204`**

---

## Batches

### `GET /api/batches`
**Query params:** `?status=in_production`
**Response `200`** → array of batches with `notes[]`

---

### `POST /api/batches`
**Permission:** `manage_batches`

**Request**
```json
{
  "recipe_id": 1, "status": "draft",
  "output_quantity": 12, "output_unit": "wheels",
  "note": "First batch of the season"
}
```
**Response `201`** → created batch
> To create N batches, call this endpoint N times (frontend handles the loop).

---

### `PUT /api/batches/{id}`
**Permission:** `manage_batches`

**Request** — any updatable fields:
```json
{ "status": "in_production", "output_quantity": 14 }
```
**Backend side-effects on `status` change:**
- `draft → in_production`: deduct `input_materials` quantities from `inventory_items`, write `inventory_history` per item
- `* → completed | failed`: set `completed_at = today`
- `* → failed`: create `Notification` for supervisors

**Response `200`** → updated batch

---

### `DELETE /api/batches/{id}`
**Permission:** `manage_batches` | **Response `204`**

---

### `POST /api/batches/{id}/notes`
**Request** `{ "text": "Slightly salty, monitor aging" }`
Backend sets `author_id` and `author` from JWT.
**Response `201`** → `{ "id": ..., "text": "...", "author": "Marie Dupont", "created_at": "..." }`

---

## Quality Control

### `GET /api/quality`
**Response `200`** → all evaluations with `batch` info embedded

### `GET /api/quality/batch/{batchId}`
Returns single evaluation for a batch.

---

### `POST /api/quality`
**Permission:** `manage_quality`

**Request**
```json
{
  "batch_id": 5, "taste": 4, "texture": 3, "smell": 5,
  "approved": true, "notes": "Good texture, slight over-salting."
}
```
**Backend side-effects:**
1. Computes `overall_score = (taste + texture + smell) / 3`
2. `UPDATE batches SET quality_score = overall_score WHERE id = batch_id`
3. `evaluated_by` and `evaluator` set from JWT

**Response `201`** → created QC record

---

### `PUT /api/quality/{id}`
**Permission:** `manage_quality`
**Request** → same body as POST | **Response `200`**

---

### `DELETE /api/quality/{id}`
**Permission:** `manage_quality` | **Response `204`**

---

## Customers

### `GET /api/customers`
**Response `200`** → array of customers

### `POST /api/customers`
**Request** `{ "name": "Épicerie Centrale", "email": "...", "phone": "...", "address": "..." }`
**Response `201`**

### `PUT /api/customers/{id}` | **Response `200`**
### `DELETE /api/customers/{id}` | **Response `204`**

---

## Orders

### `GET /api/orders`
**Query params:** `?search=jean&status=partial`
**Response `200`**
```json
[{
  "id": 1, "customer_id": 2, "customer_name": "Épicerie Centrale",
  "total_amount": 450.00, "amount_paid": 200.00, "amount_returned": 0,
  "status": "partial",
  "items": [...], "payments": [...], "returns": [...],
  "created_at": "2025-03-12"
}]
```

---

### `POST /api/orders`
**Permission:** `manage_sales`

**Request**
```json
{
  "customer_id": 2,
  "items": [
    { "product_name": "Camembert", "quantity": 10, "unit_price": 8.50 },
    { "product_name": "Brie", "quantity": 5, "unit_price": 12.00 }
  ]
}
```
Backend computes `total_amount = sum(qty × unit_price)` and `total` per item.
**Response `201`** → created order with `status: pending`

---

### `POST /api/orders/{id}/payments`
**Permission:** `manage_sales`

**Request** `{ "amount": 150.00, "method": "cash", "paid_at": "2025-03-15" }`

**Backend side-effects:**
- Add payment record
- Recalculate `amount_paid`
- If `amount_paid >= total_amount` → `status = paid`, `paid_at = now()`
- Else → `status = partial`

**Response `201`** → updated order

---

### `POST /api/orders/{id}/returns`
**Permission:** `manage_sales`

**Request**
```json
{ "product_name": "Camembert", "quantity": 2, "reason": "Damaged packaging", "refund_amount": 17.00, "returned_at": "2025-03-20" }
```
Backend increments `amount_returned`.
**Response `201`** → updated order

---

### `PATCH /api/orders/{id}/status`
**Permission:** `manage_sales`

**Request** `{ "status": "shipped" }` or `{ "status": "cancelled" }`
**Response `200`** → updated order

---

## Production Logs

### `GET /api/production-logs`
**Query params:** `?batch_id=5`
**Response `200`** → array of logs with `leftovers[]`

---

### `POST /api/production-logs`
**Permission:** `manage_batches`

**Request**
```json
{
  "batch_id": 5, "produced_pieces": 14, "unit": "wheels",
  "notes": "Slightly thicker rind than expected.",
  "leftovers": [
    { "material_name": "Whey", "quantity": 80, "unit": "liters" }
  ]
}
```
Backend sets `operator_id` and `operator_name` from JWT.
**Response `201`**

---

### `DELETE /api/production-logs/{id}`
**Permission:** `manage_batches` | **Response `204`**

---

## Analytics

> All analytics endpoints derive values from real DB data.

### `GET /api/analytics/summary`
**Permission:** `view_analytics`

**Response `200`**
```json
{
  "total_revenue": 18500.00,
  "active_batches": 3,
  "completed_batches_this_month": 7,
  "low_stock_count": 2,
  "inventory_count": 14,
  "batch_success_rate": 87
}
```

---

### `GET /api/analytics/sales-chart`
**Query params:** `?months=6`
**Response `200`**
```json
[
  { "month": "Oct", "sales": 2400 },
  { "month": "Nov", "sales": 3100 }
]
```

---

### `GET /api/analytics/batch-chart`
**Query params:** `?months=6`
**Response `200`**
```json
[{ "month": "Oct", "completed": 4, "failed": 1 }]
```

---

### `GET /api/analytics/recipe-usage`
**Response `200`**
```json
[{ "name": "Camembert Classique", "batches": 8 }]
```

---

## Notifications

### `GET /api/notifications`
Returns notifications for the **current user** (from JWT), newest first.
**Query params:** `?unread=true`

**Response `200`**
```json
[{ "id": 1, "title": "Low Stock Alert", "message": "Whole Milk below min stock (80 / 100 liters)", "type": "warning", "read": false, "created_at": "2025-03-25T14:30:00Z" }]
```

---

### `PATCH /api/notifications/{id}/read`
Mark as read. **Response `200`** → `{ "read": true }`

### `DELETE /api/notifications/{id}`
Dismiss notification. **Response `204`**

---

## Standard Response Formats

### Success
```json
HTTP 200 / 201 / 204
Content-Type: application/json
{ "data": { ... } }          // single resource
{ "data": [ ... ] }          // collection
```

### Validation Error
```json
HTTP 422
{
  "message": "The given data was invalid.",
  "errors": { "email": ["The email field is required."] }
}
```

### Auth Error
```json
HTTP 401  { "message": "Unauthenticated." }
HTTP 403  { "message": "This action is unauthorized." }
```

### Not Found
```json
HTTP 404  { "message": "Not found." }
```
