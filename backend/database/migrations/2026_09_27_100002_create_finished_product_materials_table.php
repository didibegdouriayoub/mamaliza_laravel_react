<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Packaging items consumed per piece (vacbag, label, ticket, etc.)
        Schema::create('finished_product_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('finished_product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_item_id')->constrained()->cascadeOnDelete();
            $table->decimal('qty_per_piece', 10, 4);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finished_product_materials');
    }
};
