<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// The dough per piece now lives on the product (finished_product_inputs.kg_per_piece), not on the recipe.
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('recipes', 'piece_weight')) {
            Schema::table('recipes', function (Blueprint $table) {
                $table->dropColumn('piece_weight');
            });
        }
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->string('piece_weight')->nullable()->after('target_weight');
        });
    }
};
