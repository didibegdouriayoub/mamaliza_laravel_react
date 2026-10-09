<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('finished_goods_movements', function (Blueprint $table) {
            // links "pieces used for packing" movements to the packing log, so a log can be undone
            $table->unsignedBigInteger('finishing_log_id')->nullable()->after('order_item_id');
            $table->index('finishing_log_id');
        });
    }

    public function down(): void
    {
        Schema::table('finished_goods_movements', function (Blueprint $table) {
            $table->dropIndex(['finishing_log_id']);
            $table->dropColumn('finishing_log_id');
        });
    }
};
