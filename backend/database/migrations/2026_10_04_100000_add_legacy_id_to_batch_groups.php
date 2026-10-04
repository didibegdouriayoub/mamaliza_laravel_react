<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Links a batch group to its row in the legacy bakery DB so `legacy:import` can re-run safely
    public function up(): void
    {
        if (!Schema::hasColumn('batch_groups', 'legacy_id')) {
            Schema::table('batch_groups', function (Blueprint $table) {
                $table->unsignedInteger('legacy_id')->nullable()->unique()->after('id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('batch_groups', 'legacy_id')) {
            Schema::table('batch_groups', function (Blueprint $table) {
                $table->dropUnique(['legacy_id']);
                $table->dropColumn('legacy_id');
            });
        }
    }
};
