<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('finishing_logs', function (Blueprint $table) {
            // a packing log created automatically from a piece production log points back to it
            $table->unsignedBigInteger('parent_id')->nullable()->after('notes');
            $table->index('parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('finishing_logs', function (Blueprint $table) {
            $table->dropIndex(['parent_id']);
            $table->dropColumn('parent_id');
        });
    }
};
