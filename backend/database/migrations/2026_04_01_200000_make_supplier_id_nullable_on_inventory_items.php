<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement('ALTER TABLE inventory_items MODIFY COLUMN supplier_id BIGINT UNSIGNED NULL DEFAULT NULL');
    }

    public function down(): void
    {
        // Only safe to revert if no nulls exist
        DB::statement('ALTER TABLE inventory_items MODIFY COLUMN supplier_id BIGINT UNSIGNED NOT NULL');
    }
};
