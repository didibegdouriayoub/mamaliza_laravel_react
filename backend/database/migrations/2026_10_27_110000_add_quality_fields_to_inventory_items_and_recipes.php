<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Raw material category; fat / protein (per 100 g) are only filled for 'dairy_fat'. Each lot is its own item.
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('category', 30)->nullable()->after('type');
            $table->decimal('fat_pct', 5, 2)->nullable()->after('category');
            $table->decimal('protein_pct', 5, 2)->nullable()->after('fat_pct');
        });

        // Per-recipe quality targets (steps already exist); water is the default amount per batch
        Schema::table('recipes', function (Blueprint $table) {
            $table->string('cheese_type', 20)->nullable()->after('description');
            $table->decimal('target_temp', 5, 1)->nullable()->after('cheese_type');
            $table->decimal('ph_min', 3, 2)->nullable()->after('target_temp');
            $table->decimal('ph_max', 3, 2)->nullable()->after('ph_min');
            $table->decimal('default_water_kg', 8, 3)->nullable()->after('ph_max');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn(['category', 'fat_pct', 'protein_pct']);
        });
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn(['cheese_type', 'target_temp', 'ph_min', 'ph_max', 'default_water_kg']);
        });
    }
};
