<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // For box-type products: which piece products it contains and how many
        Schema::create('finished_product_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('finished_product_id')->constrained()->cascadeOnDelete();
            // The component must be a 'piece' type finished product
            $table->unsignedBigInteger('component_id');
            $table->foreign('component_id')->references('id')->on('finished_products')->cascadeOnDelete();
            $table->decimal('qty_per_box', 10, 4);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finished_product_components');
    }
};
