<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A batch group is "done" once its leftover dough has been recorded
        Schema::table('batch_groups', function (Blueprint $table) {
            $table->timestamp('closed_at')->nullable()->after('leftover_unit');
        });
    }

    public function down(): void
    {
        Schema::table('batch_groups', function (Blueprint $table) {
            $table->dropColumn('closed_at');
        });
    }
};
