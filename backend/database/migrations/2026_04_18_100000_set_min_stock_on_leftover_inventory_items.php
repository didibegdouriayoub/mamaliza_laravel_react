<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // All leftover items should have min_stock = 1 so the low-stock
        // observer can fire when they drop to 0.
        \DB::table('inventory_items')
            ->where('type', 'leftover')
            ->update(['min_stock' => 1]);
    }

    public function down(): void
    {
        \DB::table('inventory_items')
            ->where('type', 'leftover')
            ->update(['min_stock' => 0]);
    }
};
