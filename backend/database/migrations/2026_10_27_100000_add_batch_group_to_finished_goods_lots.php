<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Source batch of a stock lot added by hand (admin adjustment)
        Schema::table('finished_goods_lots', function (Blueprint $table) {
            $table->foreignId('batch_group_id')->nullable()->after('finishing_log_id')
                ->constrained('batch_groups')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('finished_goods_lots', function (Blueprint $table) {
            $table->dropConstrainedForeignId('batch_group_id');
        });
    }
};
