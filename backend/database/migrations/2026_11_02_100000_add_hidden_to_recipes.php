<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Recipes the owner does not want in the way: hidden from the Recipes list until "Show hidden" is pressed
        Schema::table('recipes', function (Blueprint $table) {
            $table->boolean('hidden')->default(false)->after('recipe_status');
        });
    }

    public function down(): void
    {
        Schema::table('recipes', function (Blueprint $table) {
            $table->dropColumn('hidden');
        });
    }
};
