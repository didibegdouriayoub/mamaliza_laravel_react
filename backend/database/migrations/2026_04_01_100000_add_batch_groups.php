<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('batch_groups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('recipe_id')->nullable();
            $table->string('recipe_name');
            $table->integer('batch_count')->default(1);
            $table->decimal('target_weight', 10, 3)->default(0);
            $table->decimal('piece_weight_value', 10, 3)->default(0);
            $table->decimal('pieces_produced', 10, 2)->nullable();
            $table->decimal('leftover_qty', 10, 3)->nullable();
            $table->string('leftover_unit', 50)->default('kg');
            $table->string('created_by')->nullable();
            $table->timestamps();
        });

        Schema::table('batches', function (Blueprint $table) {
            $table->unsignedBigInteger('batch_group_id')->nullable()->after('id');
            $table->foreign('batch_group_id')->references('id')->on('batch_groups')->nullOnDelete();
        });

        DB::statement("ALTER TABLE batches MODIFY COLUMN status ENUM('completed','failed') NOT NULL DEFAULT 'completed'");
        DB::statement("ALTER TABLE inventory_items MODIFY COLUMN type ENUM('raw','packaging','leftover','product') NOT NULL DEFAULT 'raw'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE inventory_items MODIFY COLUMN type ENUM('raw','packaging') NOT NULL DEFAULT 'raw'");
        DB::statement("ALTER TABLE batches MODIFY COLUMN status ENUM('draft','in_production','completed','failed') NOT NULL DEFAULT 'draft'");
        Schema::table('batches', function (Blueprint $table) {
            $table->dropForeign(['batch_group_id']);
            $table->dropColumn('batch_group_id');
        });
        Schema::dropIfExists('batch_groups');
    }
};
