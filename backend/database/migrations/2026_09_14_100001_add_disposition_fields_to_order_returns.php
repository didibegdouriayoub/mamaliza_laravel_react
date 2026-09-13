<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Pre-existing bug: the column was NOT NULL even though the API has always
        // accepted returns with no order_item_id (e.g. a return not tied to a line item).
        // Raw SQL (not ->change()) to avoid a doctrine/dbal dependency, matching the
        // convention used in 2026_06_03_100004_change_inventory_items_type_to_varchar.
        Schema::table('order_returns', function (Blueprint $table) {
            $table->dropForeign(['order_item_id']);
        });
        DB::statement('ALTER TABLE order_returns MODIFY COLUMN order_item_id BIGINT UNSIGNED NULL');
        Schema::table('order_returns', function (Blueprint $table) {
            $table->foreign('order_item_id')->references('id')->on('order_items')->cascadeOnDelete();
        });

        Schema::table('order_returns', function (Blueprint $table) {
            $table->string('unit')->default('piece')->after('quantity'); // piece | carton
            $table->foreignId('carton_id')->nullable()->after('unit')
                ->constrained('packaging_cartons')->nullOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->after('carton_id')
                ->constrained('inventory_items')->nullOnDelete();
            // restock: back to sellable stock | reemploi: reworked into a different inventory item | perte: written off
            $table->string('disposition')->nullable()->after('reason');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_returns', function (Blueprint $table) {
            $table->dropColumn('disposition');
            $table->dropConstrainedForeignId('inventory_item_id');
            $table->dropConstrainedForeignId('carton_id');
            $table->dropColumn('unit');
        });
    }
};
