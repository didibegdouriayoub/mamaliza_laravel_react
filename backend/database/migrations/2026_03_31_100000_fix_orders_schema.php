<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // T12.7.5: Make customer_id nullable (walk-in customers have no account)
        DB::statement('ALTER TABLE orders MODIFY customer_id BIGINT UNSIGNED NULL');

        // T12.7.2 + T12.7.7: Make order_item_id nullable and add product_name to order_returns
        DB::statement('ALTER TABLE order_returns MODIFY order_item_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE order_returns ADD COLUMN product_name VARCHAR(255) NULL AFTER order_id');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE order_returns DROP COLUMN product_name');
        DB::statement('ALTER TABLE order_returns MODIFY order_item_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE orders MODIFY customer_id BIGINT UNSIGNED NOT NULL');
    }
};
