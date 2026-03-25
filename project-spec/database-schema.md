# Database Schema — Fromagerie (MySQL 8.0)

> ORM: Laravel Eloquent | Migrations: Laravel standard | Charset: `utf8mb4`

---

## Entity Relationship Overview

```
users ──< batches                  (operator)
users ──< production_logs          (operator)
users ──< inventory_history        (changed_by)
users ──< recipe_history           (changed_by)
users ──< notifications

suppliers ──< inventory_items

inventory_items ──< recipe_ingredients
inventory_items ──< inventory_history

recipes ──< recipe_ingredients
recipes ──< recipe_history
recipes ──< batches

batches ──< batch_notes
batches ──  quality_controls       (1:1)
batches ──< production_logs

production_logs ──< production_log_leftovers

customers ──< orders
orders ──< order_items
orders ──< payments
orders ──< order_returns
```

---

## Tables

### `users`
```sql
id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
name            VARCHAR(255)   NOT NULL
email           VARCHAR(255)   NOT NULL UNIQUE
password        VARCHAR(255)   NOT NULL          -- bcrypt
role            ENUM('admin','supervisor','operator') NOT NULL DEFAULT 'operator'
permissions     JSON           NOT NULL          -- ["manage_inventory", ...]
avatar          VARCHAR(255)   NULL
remember_token  VARCHAR(100)   NULL
created_at      TIMESTAMP      NULL
updated_at      TIMESTAMP      NULL

INDEX idx_users_email (email)
INDEX idx_users_role  (role)
```

---

### `suppliers`
```sql
id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
name       VARCHAR(255) NOT NULL
contact    VARCHAR(255) NOT NULL
email      VARCHAR(255) NOT NULL
created_at TIMESTAMP NULL
updated_at TIMESTAMP NULL
```

---

### `inventory_items`
```sql
id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
name        VARCHAR(255)              NOT NULL
type        ENUM('raw','packaging')   NOT NULL
quantity    DECIMAL(12,3)             NOT NULL DEFAULT 0
unit        VARCHAR(50)               NOT NULL
price       DECIMAL(10,2)             NOT NULL DEFAULT 0
supplier_id BIGINT UNSIGNED           NOT NULL
min_stock   DECIMAL(12,3)             NOT NULL DEFAULT 0
created_at  TIMESTAMP NULL
updated_at  TIMESTAMP NULL

FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
INDEX idx_inventory_type        (type)
INDEX idx_inventory_supplier    (supplier_id)
INDEX idx_inventory_quantity    (quantity)   -- for low-stock queries
```

---

### `inventory_history`
```sql
id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
item_id       BIGINT UNSIGNED NOT NULL
field         VARCHAR(100)    NOT NULL   -- 'quantity', 'price', 'name', 'supplier'
old_value     TEXT            NOT NULL
new_value     TEXT            NOT NULL
changed_by    BIGINT UNSIGNED NOT NULL   -- users.id from JWT, never from request body
changed_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (item_id)    REFERENCES inventory_items(id) ON DELETE CASCADE
FOREIGN KEY (changed_by) REFERENCES users(id)           ON DELETE RESTRICT
INDEX idx_invhist_item      (item_id)
INDEX idx_invhist_changedat (changed_at)
```

---

### `recipes`
```sql
id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
name         VARCHAR(255)  NOT NULL
description  TEXT          NULL
yield        DECIMAL(10,3) NOT NULL DEFAULT 0
yield_unit   VARCHAR(50)   NOT NULL
version      SMALLINT UNSIGNED NOT NULL DEFAULT 1
created_at   TIMESTAMP NULL
updated_at   TIMESTAMP NULL

INDEX idx_recipes_name (name)
```

---

### `recipe_ingredients`
```sql
id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
recipe_id     BIGINT UNSIGNED NOT NULL
material_id   BIGINT UNSIGNED NOT NULL
material_name VARCHAR(255)    NOT NULL   -- snapshot at time of recipe save
quantity      DECIMAL(12,3)   NOT NULL
unit          VARCHAR(50)     NOT NULL
unit_price    DECIMAL(10,2)   NOT NULL   -- snapshot at time of recipe save

FOREIGN KEY (recipe_id)   REFERENCES recipes(id)         ON DELETE CASCADE
FOREIGN KEY (material_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
INDEX idx_recipeingr_recipe   (recipe_id)
INDEX idx_recipeingr_material (material_id)
```

---

### `recipe_history`
```sql
id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
recipe_id   BIGINT UNSIGNED NOT NULL
field       VARCHAR(100)    NOT NULL   -- 'name', 'description', 'ingredients'
old_value   TEXT            NOT NULL
new_value   TEXT            NOT NULL
changed_by  BIGINT UNSIGNED NOT NULL
changed_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP

FOREIGN KEY (recipe_id)  REFERENCES recipes(id) ON DELETE CASCADE
FOREIGN KEY (changed_by) REFERENCES users(id)   ON DELETE RESTRICT
INDEX idx_rechist_recipe    (recipe_id)
INDEX idx_rechist_changedat (changed_at)
```

---

### `batches`
```sql
id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
recipe_id       BIGINT UNSIGNED                              NOT NULL
recipe_name     VARCHAR(255)                                 NOT NULL   -- snapshot
status          ENUM('draft','in_production','completed','failed') NOT NULL DEFAULT 'draft'
input_materials JSON                                         NOT NULL   -- snapshot of recipe_ingredients at batch creation
output_quantity DECIMAL(12,3)                                NOT NULL DEFAULT 0
output_unit     VARCHAR(50)                                  NOT NULL DEFAULT ''
quality_score   DECIMAL(3,1)                                 NULL       -- set by quality_controls
operator_id     BIGINT UNSIGNED                              NOT NULL
operator_name   VARCHAR(255)                                 NOT NULL   -- snapshot
started_at      DATE                                         NOT NULL
completed_at    DATE                                         NULL

FOREIGN KEY (recipe_id)   REFERENCES recipes(id) ON DELETE RESTRICT
FOREIGN KEY (operator_id) REFERENCES users(id)   ON DELETE RESTRICT
INDEX idx_batches_status      (status)
INDEX idx_batches_recipe      (recipe_id)
INDEX idx_batches_operator    (operator_id)
INDEX idx_batches_started_at  (started_at)
```

---

### `batch_notes`
```sql
id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
batch_id   BIGINT UNSIGNED NOT NULL
text       TEXT            NOT NULL
author_id  BIGINT UNSIGNED NOT NULL
author     VARCHAR(255)    NOT NULL   -- snapshot
created_at TIMESTAMP NULL

FOREIGN KEY (batch_id)  REFERENCES batches(id) ON DELETE CASCADE
FOREIGN KEY (author_id) REFERENCES users(id)   ON DELETE RESTRICT
INDEX idx_batchnotes_batch (batch_id)
```

---

### `quality_controls`
```sql
id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
batch_id      BIGINT UNSIGNED  NOT NULL UNIQUE   -- 1 QC per batch
taste         TINYINT UNSIGNED NOT NULL CHECK (taste BETWEEN 1 AND 5)
texture       TINYINT UNSIGNED NOT NULL CHECK (texture BETWEEN 1 AND 5)
smell         TINYINT UNSIGNED NOT NULL CHECK (smell BETWEEN 1 AND 5)
overall_score DECIMAL(3,1)     NOT NULL
approved      BOOLEAN          NOT NULL DEFAULT FALSE
evaluated_by  BIGINT UNSIGNED  NOT NULL
evaluator     VARCHAR(255)     NOT NULL   -- snapshot
notes         TEXT             NULL
evaluated_at  DATE             NOT NULL

FOREIGN KEY (batch_id)     REFERENCES batches(id) ON DELETE CASCADE
FOREIGN KEY (evaluated_by) REFERENCES users(id)   ON DELETE RESTRICT
INDEX idx_qc_batch    (batch_id)
INDEX idx_qc_approved (approved)
```

---

### `customers`
```sql
id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
name       VARCHAR(255) NOT NULL
email      VARCHAR(255) NULL
phone      VARCHAR(50)  NULL
address    TEXT         NULL
created_at TIMESTAMP NULL
updated_at TIMESTAMP NULL

INDEX idx_customers_name (name)
```

---

### `orders`
```sql
id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
customer_id      BIGINT UNSIGNED NOT NULL
customer_name    VARCHAR(255)    NOT NULL   -- snapshot
total_amount     DECIMAL(12,2)   NOT NULL DEFAULT 0
amount_paid      DECIMAL(12,2)   NOT NULL DEFAULT 0
amount_returned  DECIMAL(12,2)   NOT NULL DEFAULT 0
status           ENUM('pending','partial','paid','shipped','cancelled') NOT NULL DEFAULT 'pending'
created_at       TIMESTAMP NULL
updated_at       TIMESTAMP NULL
paid_at          TIMESTAMP NULL

FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
INDEX idx_orders_customer  (customer_id)
INDEX idx_orders_status    (status)
INDEX idx_orders_created   (created_at)
```

---

### `order_items`
```sql
id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
order_id     BIGINT UNSIGNED NOT NULL
product_name VARCHAR(255)    NOT NULL
quantity     DECIMAL(10,3)   NOT NULL
unit_price   DECIMAL(10,2)   NOT NULL
total        DECIMAL(12,2)   NOT NULL

FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
INDEX idx_orderitems_order (order_id)
```

---

### `payments`
```sql
id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
order_id   BIGINT UNSIGNED NOT NULL
amount     DECIMAL(12,2)   NOT NULL
method     ENUM('cash','card','bank_transfer','check') NOT NULL
paid_at    DATE            NOT NULL
created_at TIMESTAMP NULL

FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
INDEX idx_payments_order (order_id)
```

---

### `order_returns`
```sql
id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
order_id      BIGINT UNSIGNED NOT NULL
product_name  VARCHAR(255)    NOT NULL
quantity      DECIMAL(10,3)   NOT NULL
reason        TEXT            NULL
refund_amount DECIMAL(12,2)   NOT NULL
returned_at   DATE            NOT NULL
created_at    TIMESTAMP NULL

FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
INDEX idx_returns_order (order_id)
```

---

### `production_logs`
```sql
id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
batch_id        BIGINT UNSIGNED NOT NULL
operator_id     BIGINT UNSIGNED NOT NULL
operator_name   VARCHAR(255)    NOT NULL   -- snapshot
produced_pieces DECIMAL(12,3)   NOT NULL
unit            VARCHAR(50)     NOT NULL
notes           TEXT            NULL
logged_at       DATE            NOT NULL
created_at      TIMESTAMP NULL

FOREIGN KEY (batch_id)    REFERENCES batches(id) ON DELETE CASCADE
FOREIGN KEY (operator_id) REFERENCES users(id)   ON DELETE RESTRICT
INDEX idx_prodlogs_batch    (batch_id)
INDEX idx_prodlogs_operator (operator_id)
```

---

### `production_log_leftovers`
```sql
id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
log_id         BIGINT UNSIGNED NOT NULL
material_name  VARCHAR(255)    NOT NULL
quantity       DECIMAL(12,3)   NOT NULL
unit           VARCHAR(50)     NOT NULL

FOREIGN KEY (log_id) REFERENCES production_logs(id) ON DELETE CASCADE
INDEX idx_leftovers_log (log_id)
```

---

### `notifications`
```sql
id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
user_id    BIGINT UNSIGNED NOT NULL
title      VARCHAR(255)    NOT NULL
message    TEXT            NOT NULL
type       ENUM('info','success','warning','error') NOT NULL DEFAULT 'info'
read       BOOLEAN         NOT NULL DEFAULT FALSE
created_at TIMESTAMP NULL

FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
INDEX idx_notifications_user (user_id)
INDEX idx_notifications_read (read)
```

---

## Laravel Migration Order

Run migrations in this dependency order:

```
1.  create_users_table
2.  create_suppliers_table
3.  create_inventory_items_table
4.  create_inventory_history_table
5.  create_recipes_table
6.  create_recipe_ingredients_table
7.  create_recipe_history_table
8.  create_batches_table
9.  create_batch_notes_table
10. create_quality_controls_table
11. create_customers_table
12. create_orders_table
13. create_order_items_table
14. create_payments_table
15. create_order_returns_table
16. create_production_logs_table
17. create_production_log_leftovers_table
18. create_notifications_table
19. create_personal_access_tokens_table   ← Sanctum
```

## Seeders

```
DatabaseSeeder
├── UserSeeder          (3 demo users: admin, supervisor, operator)
├── SupplierSeeder      (3–5 suppliers)
├── InventorySeeder     (10+ items: raw + packaging)
├── RecipeSeeder        (3+ recipes with ingredients)
└── BatchSeeder         (mixed-status batches for demo)
```
