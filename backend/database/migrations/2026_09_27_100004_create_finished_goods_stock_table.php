<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('finished_goods_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('finished_product_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('quantity', 10, 4)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finished_goods_stock');
    }
};
