<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('batches', 'lot')) {
            Schema::table('batches', function (Blueprint $table) {
                $table->string('lot', 100)->nullable()->after('recipe_name');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('batches', 'lot')) {
            Schema::table('batches', function (Blueprint $table) {
                $table->dropColumn('lot');
            });
        }
    }
};
