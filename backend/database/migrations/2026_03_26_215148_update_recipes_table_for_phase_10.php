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
        Schema::table('recipes', function (Blueprint $table) {
            $table->renameColumn('yield', 'target_weight');
            $table->renameColumn('yield_unit', 'piece_weight');
            $table->string('recipe_status', 20)->default('semi_final')->after('piece_weight');
            $table->json('packages')->nullable()->after('recipe_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->renameColumn('target_weight', 'yield');
            $table->renameColumn('piece_weight', 'yield_unit');
            $table->dropColumn(['recipe_status', 'packages']);
        });
    }
};
