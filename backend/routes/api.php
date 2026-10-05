<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AuthController;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Core Resources
    // Users
    Route::get('/users', [\App\Http\Controllers\UserController::class, 'index'])->middleware('permission:users.read');
    Route::post('/users', [\App\Http\Controllers\UserController::class, 'store'])->middleware('permission:users.write');
    Route::get('/users/{user}', [\App\Http\Controllers\UserController::class, 'show'])->middleware('permission:users.read');
    Route::match(['put', 'patch'], '/users/{user}', [\App\Http\Controllers\UserController::class, 'update'])->middleware('permission:users.write');
    Route::delete('/users/{user}', [\App\Http\Controllers\UserController::class, 'destroy'])->middleware('permission:users.write');

    // Permissions
    Route::get('/permissions', [\App\Http\Controllers\PermissionController::class, 'index'])->middleware('permission:permissions.read');
    Route::post('/permissions', [\App\Http\Controllers\PermissionController::class, 'store'])->middleware('permission:permissions.write');

    // Suppliers
    Route::get('/suppliers', [\App\Http\Controllers\SupplierController::class, 'index'])->middleware('permission:suppliers.read');
    Route::post('/suppliers', [\App\Http\Controllers\SupplierController::class, 'store'])->middleware('permission:suppliers.write');
    Route::get('/suppliers/{supplier}', [\App\Http\Controllers\SupplierController::class, 'show'])->middleware('permission:suppliers.read');
    Route::match(['put', 'patch'], '/suppliers/{supplier}', [\App\Http\Controllers\SupplierController::class, 'update'])->middleware('permission:suppliers.write');
    Route::delete('/suppliers/{supplier}', [\App\Http\Controllers\SupplierController::class, 'destroy'])->middleware('permission:suppliers.write');

    // Inventory
    Route::get('/inventory', [\App\Http\Controllers\InventoryItemController::class, 'index'])->middleware('permission:inventory.read');
    Route::post('/inventory', [\App\Http\Controllers\InventoryItemController::class, 'store'])->middleware('permission:inventory.write');
    Route::get('/inventory/history/all', [\App\Http\Controllers\InventoryItemController::class, 'allHistory'])->middleware('permission:inventory.read');
    Route::get('/inventory/{inventory}', [\App\Http\Controllers\InventoryItemController::class, 'show'])->middleware('permission:inventory.read');
    Route::get('/inventory/{inventory}/recipe-usage', [\App\Http\Controllers\RecipeIngredientReplaceController::class, 'usage']);
    Route::match(['put', 'patch'], '/inventory/{inventory}', [\App\Http\Controllers\InventoryItemController::class, 'update'])->middleware('permission:inventory.write');
    Route::delete('/inventory/{inventory}', [\App\Http\Controllers\InventoryItemController::class, 'destroy'])->middleware('permission:inventory.write');

    // Recipes
    Route::get('/recipes', [\App\Http\Controllers\RecipeController::class, 'index'])->middleware('permission:recipes.read');
    Route::post('/recipes', [\App\Http\Controllers\RecipeController::class, 'store'])->middleware('permission:recipes.write');
    Route::get('/recipes/{recipe}', [\App\Http\Controllers\RecipeController::class, 'show'])->middleware('permission:recipes.read');
    Route::match(['put', 'patch'], '/recipes/{recipe}', [\App\Http\Controllers\RecipeController::class, 'update'])->middleware('permission:recipes.write');
    Route::delete('/recipes/{recipe}', [\App\Http\Controllers\RecipeController::class, 'destroy'])->middleware('permission:recipes.write');
    Route::post('/recipes/replace-ingredient', [\App\Http\Controllers\RecipeIngredientReplaceController::class, 'replace']);

    // Batches
    Route::get('/batches', [\App\Http\Controllers\BatchController::class, 'index'])->middleware('permission:batches.read');
    Route::post('/batches', [\App\Http\Controllers\BatchController::class, 'store'])->middleware('permission:batches.write');
    Route::get('/batches/{batch}', [\App\Http\Controllers\BatchController::class, 'show'])->middleware('permission:batches.read');
    Route::match(['put', 'patch'], '/batches/{batch}', [\App\Http\Controllers\BatchController::class, 'update'])->middleware('permission:batches.write');
    Route::delete('/batches/{batch}', [\App\Http\Controllers\BatchController::class, 'destroy'])->middleware('permission:batches.write');
    Route::post('/batches/{batch}/notes', [\App\Http\Controllers\BatchController::class, 'storeNote'])->middleware('permission:batches.write');

    // Batch Groups — readable by anyone who can see batches, pieces, or leftover
    Route::get('/batch-groups', [\App\Http\Controllers\BatchGroupController::class, 'index'])->middleware('permission:batches.read,pieces.read,leftover.read');
    Route::post('/batch-groups', [\App\Http\Controllers\BatchGroupController::class, 'store'])->middleware('permission:batches.write');
    Route::match(['put', 'patch'], '/batch-groups/{batchGroup}', [\App\Http\Controllers\BatchGroupController::class, 'update'])->middleware('permission:batches.write,pieces.write,leftover.write');
    Route::delete('/batch-groups/{batchGroup}', [\App\Http\Controllers\BatchGroupController::class, 'destroy'])->middleware('permission:batches.write');

    // Quality Controls
    Route::get('/quality-controls', [\App\Http\Controllers\QualityControlController::class, 'index'])->middleware('permission:quality.read');
    Route::post('/quality-controls', [\App\Http\Controllers\QualityControlController::class, 'store'])->middleware('permission:quality.write');
    Route::get('/quality-controls/{quality_control}', [\App\Http\Controllers\QualityControlController::class, 'show'])->middleware('permission:quality.read');
    Route::match(['put', 'patch'], '/quality-controls/{quality_control}', [\App\Http\Controllers\QualityControlController::class, 'update'])->middleware('permission:quality.write');
    Route::delete('/quality-controls/{quality_control}', [\App\Http\Controllers\QualityControlController::class, 'destroy'])->middleware('permission:quality.write');

    // Customers
    Route::get('/customers', [\App\Http\Controllers\CustomerController::class, 'index'])->middleware('permission:customers.read');
    Route::post('/customers', [\App\Http\Controllers\CustomerController::class, 'store'])->middleware('permission:customers.write');
    Route::get('/customers/{customer}', [\App\Http\Controllers\CustomerController::class, 'show'])->middleware('permission:customers.read');
    Route::match(['put', 'patch'], '/customers/{customer}', [\App\Http\Controllers\CustomerController::class, 'update'])->middleware('permission:customers.write');
    Route::delete('/customers/{customer}', [\App\Http\Controllers\CustomerController::class, 'destroy'])->middleware('permission:customers.write');

    // Orders
    Route::get('/orders', [\App\Http\Controllers\OrderController::class, 'index'])->middleware('permission:sales.read');
    Route::post('/orders', [\App\Http\Controllers\OrderController::class, 'store'])->middleware('permission:sales.write');
    Route::get('/orders/{order}', [\App\Http\Controllers\OrderController::class, 'show'])->middleware('permission:sales.read');
    Route::match(['put', 'patch'], '/orders/{order}', [\App\Http\Controllers\OrderController::class, 'update'])->middleware('permission:sales.write');
    Route::delete('/orders/{order}', [\App\Http\Controllers\OrderController::class, 'destroy'])->middleware('permission:sales.write');
    Route::post('/orders/{order}/payments', [\App\Http\Controllers\OrderController::class, 'storePayment'])->middleware('permission:sales.write');
    Route::post('/orders/{order}/returns', [\App\Http\Controllers\OrderController::class, 'storeReturn'])->middleware('permission:sales.write');
    Route::patch('/orders/{order}/status', [\App\Http\Controllers\OrderController::class, 'updateStatus'])->middleware('permission:sales.write');

    // Production Logs
    Route::get('/production-logs', [\App\Http\Controllers\ProductionLogController::class, 'index'])->middleware('permission:batches.read,leftover.read');
    Route::post('/production-logs', [\App\Http\Controllers\ProductionLogController::class, 'store'])->middleware('permission:batches.write,leftover.write');
    Route::delete('/production-logs/{production_log}', [\App\Http\Controllers\ProductionLogController::class, 'destroy'])->middleware('permission:batches.write,leftover.write');

    // Notifications — no extra permission needed beyond auth:sanctum
    Route::get('/notifications', [\App\Http\Controllers\NotificationController::class, 'index']);
    Route::patch('/notifications/{notification}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
    Route::delete('/notifications', [\App\Http\Controllers\NotificationController::class, 'destroyAll']);
    Route::delete('/notifications/{notification}', [\App\Http\Controllers\NotificationController::class, 'destroy']);

    // Analytics
    Route::get('/analytics/dashboard', [\App\Http\Controllers\AnalyticsController::class, 'dashboard'])->middleware('permission:analytics.read');

    // Finished Products catalog
    Route::get('/finished-products', [\App\Http\Controllers\FinishedProductController::class, 'index']);
    Route::post('/finished-products', [\App\Http\Controllers\FinishedProductController::class, 'store']);
    Route::match(['put', 'patch'], '/finished-products/{finishedProduct}', [\App\Http\Controllers\FinishedProductController::class, 'update']);
    Route::delete('/finished-products/{finishedProduct}', [\App\Http\Controllers\FinishedProductController::class, 'destroy']);

    // Finishing / Assembly logs
    Route::get('/finishing-logs', [\App\Http\Controllers\FinishingLogController::class, 'index']);
    Route::post('/finishing-logs', [\App\Http\Controllers\FinishingLogController::class, 'store']);
    Route::delete('/finishing-logs/{finishingLog}', [\App\Http\Controllers\FinishingLogController::class, 'destroy']);

});
