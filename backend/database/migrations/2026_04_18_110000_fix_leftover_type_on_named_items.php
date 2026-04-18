<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Items whose name starts with "Leftovers" were imported as type='raw'
        // from bakery.sql — correct them to type='leftover' with min_stock=1.
        \DB::table('inventory_items')
            ->where('name', 'like', 'Leftovers%')
            ->where('type', '!=', 'leftover')
            ->update([
                'type'      => 'leftover',
                'min_stock' => 1,
                'status'    => \DB::raw("CASE WHEN quantity <= 0 THEN 'out' WHEN quantity <= 1 THEN 'low' ELSE 'ok' END"),
            ]);
    }

    public function down(): void
    {
        \DB::table('inventory_items')
            ->where('name', 'like', 'Leftovers%')
            ->where('type', 'leftover')
            ->update(['type' => 'raw', 'min_stock' => 200]);
    }
};
