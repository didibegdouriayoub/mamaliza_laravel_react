<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('finished_product_id')->nullable()->after('product_name')
                ->constrained('finished_products')->nullOnDelete();
        });

        Schema::table('order_returns', function (Blueprint $table) {
            $table->foreignId('finished_product_id')->nullable()->after('inventory_item_id')
                ->constrained('finished_products')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_returns', function (Blueprint $table) {
            $table->dropConstrainedForeignId('finished_product_id');
        });
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('finished_product_id');
        });
    }
};
