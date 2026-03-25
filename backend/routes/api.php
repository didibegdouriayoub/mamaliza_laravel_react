<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AuthController;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Core Resources
    Route::apiResource('users', \App\Http\Controllers\UserController::class);
    Route::apiResource('suppliers', \App\Http\Controllers\SupplierController::class);
    Route::apiResource('inventory', \App\Http\Controllers\InventoryItemController::class);
    Route::apiResource('recipes', \App\Http\Controllers\RecipeController::class);
    Route::apiResource('batches', \App\Http\Controllers\BatchController::class);
    Route::apiResource('quality-controls', \App\Http\Controllers\QualityControlController::class);
    Route::apiResource('customers', \App\Http\Controllers\CustomerController::class);
    Route::apiResource('orders', \App\Http\Controllers\OrderController::class);
    Route::apiResource('production-logs', \App\Http\Controllers\ProductionLogController::class);
    Route::apiResource('notifications', \App\Http\Controllers\NotificationController::class);

    // Analytics
    Route::get('/analytics/dashboard', [\App\Http\Controllers\AnalyticsController::class, 'dashboard']);
});
