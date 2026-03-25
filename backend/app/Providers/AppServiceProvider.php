<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \App\Models\Batch::observe(\App\Observers\BatchObserver::class);
        \App\Models\QualityControl::observe(\App\Observers\QualityControlObserver::class);
        \App\Models\InventoryItem::observe(\App\Observers\InventoryItemObserver::class);
    }
}
