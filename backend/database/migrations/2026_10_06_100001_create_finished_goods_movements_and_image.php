<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('finished_goods_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('finished_product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('finished_goods_lot_id')->nullable()->constrained('finished_goods_lots')->nullOnDelete();
            // production | production_removed | order | return | adjustment
            $table->string('type', 30);
            $table->decimal('quantity', 10, 4); // signed: + enters the fridge, - leaves it
            $table->string('reason')->nullable();
            $table->unsignedBigInteger('order_id')->nullable();
            $table->unsignedBigInteger('order_item_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['finished_product_id', 'created_at']);
            $table->index('order_item_id');
        });

        Schema::table('finished_products', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('finished_products', function (Blueprint $table) {
            $table->dropColumn('image_path');
        });
        Schema::dropIfExists('finished_goods_movements');
    }
};
