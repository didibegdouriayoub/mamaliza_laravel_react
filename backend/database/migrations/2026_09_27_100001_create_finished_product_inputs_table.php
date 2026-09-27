<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Which recipe's pâte this product draws from, and how many kg per piece
        Schema::create('finished_product_inputs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('finished_product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recipe_id')->constrained()->cascadeOnDelete();
            $table->decimal('kg_per_piece', 10, 4);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finished_product_inputs');
    }
};
