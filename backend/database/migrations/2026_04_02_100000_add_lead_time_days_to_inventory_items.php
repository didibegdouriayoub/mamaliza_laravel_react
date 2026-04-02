<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('inventory_items', 'lead_time_days')) {
            Schema::table('inventory_items', function (Blueprint $table) {
                $table->unsignedSmallInteger('lead_time_days')->nullable()->after('min_stock');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('inventory_items', 'lead_time_days')) {
            Schema::table('inventory_items', function (Blueprint $table) {
                $table->dropColumn('lead_time_days');
            });
        }
    }
};
