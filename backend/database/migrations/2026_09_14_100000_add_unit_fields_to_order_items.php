<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->string('unit')->default('piece')->after('quantity'); // piece | carton
            $table->foreignId('carton_id')->nullable()->after('unit')
                ->constrained('packaging_cartons')->nullOnDelete();
            $table->foreignId('inventory_item_id')->nullable()->after('carton_id')
                ->constrained('inventory_items')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inventory_item_id');
            $table->dropConstrainedForeignId('carton_id');
            $table->dropColumn('unit');
        });
    }
};
