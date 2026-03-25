# Laravel Backend Structure — Fromagerie

> Laravel 11 | PHP 8.3 | Laravel Sanctum | MySQL 8.0

---

## Project Initialization

```bash
composer create-project laravel/laravel backend
cd backend
composer require laravel/sanctum
composer require knuckleswtf/scribe --dev   # API docs
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
```

---

## Directory Structure

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/
│   │   │   │   └── AuthController.php
│   │   │   ├── UserController.php
│   │   │   ├── SupplierController.php
│   │   │   ├── InventoryItemController.php
│   │   │   ├── RecipeController.php
│   │   │   ├── BatchController.php
│   │   │   ├── BatchNoteController.php
│   │   │   ├── QualityControlController.php
│   │   │   ├── CustomerController.php
│   │   │   ├── OrderController.php
│   │   │   ├── PaymentController.php
│   │   │   ├── OrderReturnController.php
│   │   │   ├── ProductionLogController.php
│   │   │   ├── NotificationController.php
│   │   │   └── AnalyticsController.php
│   │   ├── Middleware/
│   │   │   └── CheckPermission.php       ← custom permission guard
│   │   └── Requests/                     ← Form Request validation classes
│   │       ├── Auth/LoginRequest.php
│   │       ├── Inventory/StoreInventoryRequest.php
│   │       ├── Inventory/UpdateInventoryRequest.php
│   │       ├── Recipe/StoreRecipeRequest.php
│   │       ├── Batch/StoreBatchRequest.php
│   │       ├── Batch/UpdateBatchRequest.php
│   │       ├── Order/StoreOrderRequest.php
│   │       ├── Order/AddPaymentRequest.php
│   │       ├── Order/AddReturnRequest.php
│   │       └── ... (one per controller action)
│   ├── Models/
│   │   ├── User.php
│   │   ├── Supplier.php
│   │   ├── InventoryItem.php
│   │   ├── InventoryHistory.php
│   │   ├── Recipe.php
│   │   ├── RecipeIngredient.php
│   │   ├── RecipeHistory.php
│   │   ├── Batch.php
│   │   ├── BatchNote.php
│   │   ├── QualityControl.php
│   │   ├── Customer.php
│   │   ├── Order.php
│   │   ├── OrderItem.php
│   │   ├── Payment.php
│   │   ├── OrderReturn.php
│   │   ├── ProductionLog.php
│   │   ├── ProductionLogLeftover.php
│   │   └── Notification.php
│   ├── Services/                          ← Business logic (not in controllers)
│   │   ├── InventoryService.php
│   │   ├── BatchService.php
│   │   ├── OrderService.php
│   │   ├── QualityService.php
│   │   └── NotificationService.php
│   └── Observers/                         ← Model event hooks
│       ├── BatchObserver.php
│       ├── InventoryItemObserver.php
│       └── QualityControlObserver.php
├── database/
│   ├── migrations/
│   │   ├── ..._create_users_table.php
│   │   ├── ..._create_suppliers_table.php
│   │   ├── ..._create_inventory_items_table.php
│   │   ├── ..._create_inventory_history_table.php
│   │   ├── ..._create_recipes_table.php
│   │   ├── ..._create_recipe_ingredients_table.php
│   │   ├── ..._create_recipe_history_table.php
│   │   ├── ..._create_batches_table.php
│   │   ├── ..._create_batch_notes_table.php
│   │   ├── ..._create_quality_controls_table.php
│   │   ├── ..._create_customers_table.php
│   │   ├── ..._create_orders_table.php
│   │   ├── ..._create_order_items_table.php
│   │   ├── ..._create_payments_table.php
│   │   ├── ..._create_order_returns_table.php
│   │   ├── ..._create_production_logs_table.php
│   │   ├── ..._create_production_log_leftovers_table.php
│   │   └── ..._create_notifications_table.php
│   └── seeders/
│       ├── DatabaseSeeder.php
│       ├── UserSeeder.php
│       ├── SupplierSeeder.php
│       ├── InventorySeeder.php
│       ├── RecipeSeeder.php
│       └── BatchSeeder.php
└── routes/
    └── api.php
```

---

## Key Models & Relationships

### `User.php`
```php
protected $fillable = ['name', 'email', 'password', 'role', 'permissions'];
protected $casts    = ['permissions' => 'array', 'password' => 'hashed'];
protected $hidden   = ['password', 'remember_token'];

public function batches()       { return $this->hasMany(Batch::class, 'operator_id'); }
public function notifications() { return $this->hasMany(Notification::class); }

public function hasPermission(string $perm): bool {
    return in_array($perm, $this->permissions ?? []);
}
```

### `InventoryItem.php`
```php
protected $casts = ['quantity' => 'decimal:3', 'price' => 'decimal:2'];

public function supplier() { return $this->belongsTo(Supplier::class); }
public function history()  { return $this->hasMany(InventoryHistory::class, 'item_id')->latest('changed_at'); }
```

### `Batch.php`
```php
protected $casts = ['input_materials' => 'array'];

public function recipe()   { return $this->belongsTo(Recipe::class); }
public function operator() { return $this->belongsTo(User::class, 'operator_id'); }
public function notes()    { return $this->hasMany(BatchNote::class); }
public function quality()  { return $this->hasOne(QualityControl::class); }
public function logs()     { return $this->hasMany(ProductionLog::class); }
```

### `Order.php`
```php
public function customer() { return $this->belongsTo(Customer::class); }
public function items()    { return $this->hasMany(OrderItem::class); }
public function payments() { return $this->hasMany(Payment::class); }
public function returns()  { return $this->hasMany(OrderReturn::class); }

public function recalculateStatus(): void {
    $this->refresh();
    if ($this->amount_paid >= $this->total_amount) {
        $this->update(['status' => 'paid', 'paid_at' => now()]);
    } elseif ($this->amount_paid > 0) {
        $this->update(['status' => 'partial']);
    }
}
```

---

## Services (Business Logic)

### `BatchService.php`
```php
public function updateStatus(Batch $batch, string $newStatus, User $actor): Batch
{
    $old = $batch->status;

    if ($old === 'draft' && $newStatus === 'in_production') {
        $this->inventoryService->deductMaterials($batch, $actor);
    }

    $batch->update([
        'status'       => $newStatus,
        'completed_at' => in_array($newStatus, ['completed', 'failed']) ? now()->toDateString() : null,
    ]);

    if ($newStatus === 'failed') {
        $this->notificationService->batchFailed($batch);
    }

    return $batch->fresh();
}
```

### `InventoryService.php`
```php
public function deductMaterials(Batch $batch, User $actor): void
{
    foreach ($batch->input_materials as $mat) {
        $item = InventoryItem::findOrFail($mat['material_id']);
        $old  = $item->quantity;
        $item->decrement('quantity', $mat['quantity']);

        InventoryHistory::create([
            'item_id'    => $item->id,
            'field'      => 'quantity',
            'old_value'  => $old,
            'new_value'  => $item->fresh()->quantity,
            'changed_by' => $actor->id,
        ]);

        if ($item->fresh()->quantity <= $item->min_stock) {
            $this->notificationService->lowStock($item);
        }
    }
}
```

### `QualityService.php`
```php
public function create(array $data, User $actor): QualityControl
{
    $overall = round(($data['taste'] + $data['texture'] + $data['smell']) / 3, 1);

    $qc = QualityControl::create([
        ...$data,
        'overall_score' => $overall,
        'evaluated_by'  => $actor->id,
        'evaluator'     => $actor->name,
        'evaluated_at'  => now()->toDateString(),
    ]);

    // Sync quality score back to batch
    $qc->batch->update(['quality_score' => $overall]);

    return $qc;
}
```

---

## Middleware — `CheckPermission`

```php
// Usage in routes: ->middleware('permission:manage_inventory')

public function handle(Request $request, Closure $next, string $permission): Response
{
    if (! $request->user()?->hasPermission($permission)) {
        return response()->json(['message' => 'This action is unauthorized.'], 403);
    }
    return $next($request);
}
```

---

## Routes (`routes/api.php`)

```php
Route::post('/auth/login',  [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {

    Route::post  ('/auth/logout', [AuthController::class, 'logout']);
    Route::get   ('/auth/me',     [AuthController::class, 'me']);

    // Users
    Route::middleware('permission:manage_users')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::patch('users/{user}/role',        [UserController::class, 'updateRole']);
        Route::patch('users/{user}/permissions', [UserController::class, 'updatePermissions']);
    });

    // Suppliers
    Route::apiResource('suppliers', SupplierController::class);

    // Inventory
    Route::middleware('permission:manage_inventory')->group(function () {
        Route::apiResource('inventory', InventoryItemController::class);
        Route::get('inventory/{item}/history', [InventoryItemController::class, 'history']);
    });

    // Recipes
    Route::middleware('permission:manage_recipes')->group(function () {
        Route::apiResource('recipes', RecipeController::class);
    });

    // Batches
    Route::middleware('permission:manage_batches')->group(function () {
        Route::apiResource('batches', BatchController::class);
        Route::post('batches/{batch}/notes', [BatchNoteController::class, 'store']);
    });

    // Quality
    Route::middleware('permission:manage_quality')->group(function () {
        Route::apiResource('quality', QualityControlController::class);
        Route::get('quality/batch/{batch}', [QualityControlController::class, 'byBatch']);
    });

    // Customers
    Route::apiResource('customers', CustomerController::class);

    // Orders
    Route::middleware('permission:manage_sales')->group(function () {
        Route::apiResource('orders', OrderController::class);
        Route::post  ('orders/{order}/payments', [PaymentController::class, 'store']);
        Route::post  ('orders/{order}/returns',  [OrderReturnController::class, 'store']);
        Route::patch ('orders/{order}/status',   [OrderController::class, 'updateStatus']);
    });

    // Production Logs
    Route::middleware('permission:manage_batches')->group(function () {
        Route::apiResource('production-logs', ProductionLogController::class);
    });

    // Analytics
    Route::middleware('permission:view_analytics')->prefix('analytics')->group(function () {
        Route::get('summary',      [AnalyticsController::class, 'summary']);
        Route::get('sales-chart',  [AnalyticsController::class, 'salesChart']);
        Route::get('batch-chart',  [AnalyticsController::class, 'batchChart']);
        Route::get('recipe-usage', [AnalyticsController::class, 'recipeUsage']);
    });

    // Notifications
    Route::get   ('notifications',          [NotificationController::class, 'index']);
    Route::patch ('notifications/{n}/read', [NotificationController::class, 'markRead']);
    Route::delete('notifications/{n}',      [NotificationController::class, 'destroy']);
});
```

---

## Observers (Event Hooks)

Register in `app/Providers/AppServiceProvider.php`:

```php
Batch::observe(BatchObserver::class);
InventoryItem::observe(InventoryItemObserver::class);
QualityControl::observe(QualityControlObserver::class);
```

### `BatchObserver.php`
```php
public function updating(Batch $batch): void {
    if ($batch->isDirty('status') && $batch->status === 'in_production') {
        app(BatchService::class)->deductInventory($batch, auth()->user());
    }
    if (in_array($batch->status, ['completed', 'failed'])) {
        $batch->completed_at = now()->toDateString();
    }
}
```

### `InventoryItemObserver.php`
```php
public function updated(InventoryItem $item): void {
    if ($item->wasChanged('quantity') && $item->quantity <= $item->min_stock) {
        app(NotificationService::class)->lowStock($item);
    }
}
```

### `QualityControlObserver.php`
```php
public function created(QualityControl $qc): void {
    $qc->batch->update(['quality_score' => $qc->overall_score]);
}
```

---

## CORS Configuration (`config/cors.php`)

```php
'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:5173')],
'allowed_methods' => ['*'],
'allowed_headers' => ['*'],
'supports_credentials' => true,
```

---

## Running the Project

```bash
# Install dependencies
composer install

# Copy env
cp .env.example .env
php artisan key:generate

# Configure .env DB credentials, then:
php artisan migrate
php artisan db:seed

# Start server
php artisan serve --port=8000
```
